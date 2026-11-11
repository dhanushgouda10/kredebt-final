package com.kredent.backend.service;

import com.kredent.backend.dto.AdminWalletLoginRequest;
import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.InstitutionSummary;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.Role;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Optional;

@Service
public class AdminAuthService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthService.class);

    /**
     * One message for every failure mode. Distinguishing "bad signature" from
     * "unknown wallet" would let an attacker enumerate which addresses hold admin
     * rights simply by watching which error comes back.
     */
    private static final String GENERIC_FAILURE = "Authentication failed";

    private final AdminRepository adminRepository;
    private final JwtService jwtService;
    private final AdminNonceService nonceService;
    private final WalletSignatureVerifier signatureVerifier;
    private final InstitutionAccessService institutionAccessService;

    public AdminAuthService(
            AdminRepository adminRepository,
            JwtService jwtService,
            AdminNonceService nonceService,
            WalletSignatureVerifier signatureVerifier,
            InstitutionAccessService institutionAccessService) {
        this.adminRepository = adminRepository;
        this.jwtService = jwtService;
        this.nonceService = nonceService;
        this.signatureVerifier = signatureVerifier;
        this.institutionAccessService = institutionAccessService;
    }

    /**
     * Issues a login challenge for the given wallet.
     *
     * Deliberately returns a nonce for ANY well-formed address, admin or not. If it
     * only responded for registered admins it would become an oracle for discovering
     * privileged wallet addresses.
     */
    public String issueNonce(String walletAddress) {
        if (!WalletSignatureVerifier.isValidAddressFormat(walletAddress)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid wallet address");
        }
        return nonceService.issue(walletAddress);
    }

    /**
     * Wallet login with proof of ownership.
     *
     * The frontend has connected MetaMask, requested a nonce, and asked the wallet to
     * personal_sign it. Here we recover the signer from that signature and confirm it
     * matches the claimed address before checking admin membership.
     *
     * Previously this method looked up the submitted address and issued a token if it
     * existed — meaning anyone who knew an admin's public address could authenticate.
     * Ethereum addresses are public by construction, so that was a full authentication
     * bypass. Possession of the private key is now required.
     */
    public AuthResponse loginWithWallet(AdminWalletLoginRequest request) {
        String address = request.getWalletAddress() == null ? "" : request.getWalletAddress().trim();

        // 1 — shape check before any work
        if (!WalletSignatureVerifier.isValidAddressFormat(address)) {
            throw unauthorized();
        }

        // 1b — the institution being signed in to must be fully onboarded on Kredent AND still
        //      APPROVED in the registry right now (re-checked on every sign-in). Institution IDs are
        //      not secret, so this step reports "not found / pending / suspended" explicitly.
        Institution institution = institutionAccessService.requireActiveByRegistryId(request.getInstitutionId());

        // 2 — single-use challenge. Consuming it here means a replayed signature fails
        //     even if the attacker captured a valid one.
        Optional<String> challenge = nonceService.consume(address);
        if (challenge.isEmpty()) {
            throw unauthorized();
        }

        // 3 — the actual proof
        if (!signatureVerifier.verifies(challenge.get(), request.getSignature(), address)) {
            log.warn("Admin wallet login rejected: signature did not verify");
            throw unauthorized();
        }

        // 3b — the wallet must be the one linked to this institution. Several institutions may
        //      share a wallet in the demo, but a wallet linked to institution A cannot open B.
        if (!address.equalsIgnoreCase(institution.getWalletAddress())) {
            log.warn("Admin wallet login rejected: wallet is not linked to institution {}", institution.getRegistryInstitutionId());
            throw unauthorized();
        }

        // 4 — signature is genuine; is this wallet actually an admin?
        Admin admin = adminRepository.findByWalletAddress(address.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> {
                    log.warn("Admin wallet login rejected: verified wallet is not registered");
                    return unauthorized();
                });

        // 5 — unchanged token issuance
        String token = jwtService.generateToken(admin.getWalletAddress(), Role.ADMIN.name(), admin.getId(), institution.getId());
        AuthResponse response = new AuthResponse(token, Role.ADMIN.name(), admin.getId(), admin.getFullName(), admin.getEmail());
        response.setInstitution(InstitutionSummary.from(institution));
        return response;
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, GENERIC_FAILURE);
    }
}
