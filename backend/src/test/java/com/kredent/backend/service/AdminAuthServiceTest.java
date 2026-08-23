package com.kredent.backend.service;

import com.kredent.backend.dto.AdminWalletLoginRequest;
import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.crypto.ECKeyPair;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminAuthServiceTest {

    private AdminRepository adminRepository;
    private JwtService jwtService;
    private AdminNonceService nonceService;
    private AdminAuthService service;

    private ECKeyPair adminKeyPair;
    private String adminAddress;

    @BeforeEach
    void setUp() throws Exception {
        adminRepository = mock(AdminRepository.class);
        jwtService = mock(JwtService.class);
        nonceService = new AdminNonceService();

        service = new AdminAuthService(
                adminRepository,
                jwtService,
                nonceService,
                new WalletSignatureVerifier()
        );

        adminKeyPair = Keys.createEcKeyPair();
        adminAddress = "0x" + Keys.getAddress(adminKeyPair);

        when(jwtService.generateToken(anyString(), anyString(), anyLong()))
                .thenReturn("test-jwt");

        Admin admin = new Admin();
        admin.setId(1L);
        admin.setFullName("MVJCE Admin");
        admin.setEmail("admin@mvjce.edu.in");
        admin.setWalletAddress(adminAddress.toLowerCase(Locale.ROOT));

        when(adminRepository.findByWalletAddress(
                adminAddress.toLowerCase(Locale.ROOT)
        )).thenReturn(Optional.of(admin));
    }

    private static String sign(String message, ECKeyPair keyPair) {
        Sign.SignatureData sig =
                Sign.signPrefixedMessage(
                        message.getBytes(StandardCharsets.UTF_8),
                        keyPair
                );

        byte[] out = new byte[65];

        System.arraycopy(sig.getR(), 0, out, 0, 32);
        System.arraycopy(sig.getS(), 0, out, 32, 32);

        out[64] = sig.getV()[0];

        return Numeric.toHexString(out);
    }

    private static AdminWalletLoginRequest request(
            String address,
            String signature
    ) {
        AdminWalletLoginRequest request = new AdminWalletLoginRequest();
        request.setWalletAddress(address);
        request.setSignature(signature);
        return request;
    }

    @Test
    void validWalletWithValidSignatureLogsIn() {
        String nonce = service.issueNonce(adminAddress);

        AuthResponse response = service.loginWithWallet(
                request(adminAddress, sign(nonce, adminKeyPair))
        );

        assertThat(response.getToken()).isEqualTo("test-jwt");
        assertThat(response.getRole()).isEqualTo("ADMIN");
    }

    @Test
    void knowingTheAddressAloneIsNotEnough() {
        service.issueNonce(adminAddress);

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                adminAddress,
                                "0x" + "00".repeat(65)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);

        verify(jwtService, never())
                .generateToken(anyString(), anyString(), anyLong());
    }

    @Test
    void signatureFromADifferentWalletIsRejected() throws Exception {
        ECKeyPair attacker = Keys.createEcKeyPair();

        String nonce = service.issueNonce(adminAddress);

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                adminAddress,
                                sign(nonce, attacker)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);

        verify(jwtService, never())
                .generateToken(anyString(), anyString(), anyLong());
    }

    @Test
    void signatureOverADifferentNonceIsRejected() {
        service.issueNonce(adminAddress);

        String staleNonce =
                "Sign in to Kredent.\n\nNonce: a-nonce-that-was-never-issued";

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                adminAddress,
                                sign(staleNonce, adminKeyPair)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void loginWithoutRequestingANonceIsRejected() {
        String madeUp =
                "Sign in to Kredent.\n\nNonce: never-issued";

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                adminAddress,
                                sign(madeUp, adminKeyPair)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aNonceCannotBeReused() {
        String nonce = service.issueNonce(adminAddress);

        String signature = sign(nonce, adminKeyPair);

        service.loginWithWallet(
                request(adminAddress, signature)
        );

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(adminAddress, signature)
                )
        ).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void unknownWalletIsRejectedEvenWithAPerfectSignature()
            throws Exception {

        ECKeyPair stranger = Keys.createEcKeyPair();

        String strangerAddress =
                "0x" + Keys.getAddress(stranger);

        when(adminRepository.findByWalletAddress(
                strangerAddress.toLowerCase(Locale.ROOT)
        )).thenReturn(Optional.empty());

        String nonce = service.issueNonce(strangerAddress);

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                strangerAddress,
                                sign(nonce, stranger)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);

        verify(jwtService, never())
                .generateToken(anyString(), anyString(), anyLong());
    }

    @Test
    void malformedSignatureIsRejectedNotAnInternalError() {
        service.issueNonce(adminAddress);

        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                adminAddress,
                                "not-a-signature"
                        )
                )
        )
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e ->
                        assertThat(
                                ((ResponseStatusException) e)
                                        .getStatusCode()
                                        .value()
                        ).isEqualTo(401)
                );
    }

    @Test
    void malformedAddressIsRejectedBeforeAnyLookup() {
        assertThatThrownBy(() ->
                service.loginWithWallet(
                        request(
                                "0x123",
                                "0x" + "00".repeat(65)
                        )
                )
        ).isInstanceOf(ResponseStatusException.class);

        verify(adminRepository, never())
                .findByWalletAddress(any());
    }

    @Test
    void allFailureModesShareOneMessage() throws Exception {
        ECKeyPair attacker = Keys.createEcKeyPair();

        String nonce = service.issueNonce(adminAddress);

        String badSignature = sign(nonce, attacker);

        String fromBadSignature = messageOf(() ->
                service.loginWithWallet(
                        request(adminAddress, badSignature)
                )
        );

        String noNonceAddress =
                "0x" + Keys.getAddress(Keys.createEcKeyPair());

        String fromMissingNonce = messageOf(() ->
                service.loginWithWallet(
                        request(
                                noNonceAddress,
                                "0x" + "00".repeat(65)
                        )
                )
        );

        assertThat(fromBadSignature)
                .isEqualTo(fromMissingNonce);
    }

    @Test
    void nonceIsIssuedForNonAdminAddressesToo()
            throws Exception {

        String stranger =
                "0x" + Keys.getAddress(Keys.createEcKeyPair());

        assertThat(service.issueNonce(stranger))
                .isNotBlank();
    }

    @Test
    void nonceRequestRejectsAMalformedAddress() {
        assertThatThrownBy(() ->
                service.issueNonce("nonsense")
        ).isInstanceOf(ResponseStatusException.class);
    }

    private static String messageOf(Runnable action) {
        try {
            action.run();

            throw new AssertionError(
                    "expected the login to fail"
            );

        } catch (ResponseStatusException e) {
            return e.getReason();
        }
    }
}