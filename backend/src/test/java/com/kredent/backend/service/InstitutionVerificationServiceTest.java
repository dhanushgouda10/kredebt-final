package com.kredent.backend.service;

import com.kredent.backend.config.OtpPolicy;
import com.kredent.backend.dto.InstitutionLookupResponse;
import com.kredent.backend.dto.InstitutionOtpSentResponse;
import com.kredent.backend.dto.InstitutionOtpVerifyResponse;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.InstitutionVerificationSession;
import com.kredent.backend.entity.VerificationSessionStatus;
import com.kredent.backend.exception.ApiException;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.registry.RegistryStatus;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.repository.InstitutionVerificationSessionRepository;
import com.kredent.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Exercises the OTP rules (expiry, attempts, single use, cooldown, status gating) with in-memory fakes. */
class InstitutionVerificationServiceTest {

    private static final String HOI_EMAIL = "hoi@greenfield.example";

    private RegistryService registryService;
    private InstitutionRepository institutionRepository;
    private InstitutionVerificationSessionRepository sessionRepository;
    private OtpMailService mailService;
    private InstitutionVerificationService service;

    private final AtomicReference<InstitutionVerificationSession> storedSession = new AtomicReference<>();
    private final AtomicReference<RegistryInstitution> registryRecord = new AtomicReference<>();

    private static RegistryInstitution registry(RegistryStatus status) {
        return new RegistryInstitution(1L, "DEMO-1001", "Greenfield Institute of Technology", "Karnataka",
                "Bengaluru Urban", "Dr. Meera Nair", HOI_EMAIL, "+91 9845001001", "hash", status, true, Instant.now());
    }

    @BeforeEach
    void setUp() {
        registryService = mock(RegistryService.class);
        institutionRepository = mock(InstitutionRepository.class);
        sessionRepository = mock(InstitutionVerificationSessionRepository.class);
        mailService = mock(OtpMailService.class);

        registryRecord.set(registry(RegistryStatus.APPROVED));
        when(registryService.findInstitution(anyString())).thenAnswer(inv -> Optional.of(registryRecord.get()));

        when(institutionRepository.findByRegistryInstitutionId(anyString())).thenReturn(Optional.empty());
        when(institutionRepository.save(any(Institution.class))).thenAnswer(inv -> inv.getArgument(0));

        when(sessionRepository.save(any(InstitutionVerificationSession.class))).thenAnswer(inv -> {
            InstitutionVerificationSession s = inv.getArgument(0);
            storedSession.set(s);
            return s;
        });
        when(sessionRepository.findByIdForUpdate(any())).thenAnswer(inv -> Optional.ofNullable(storedSession.get()));
        when(sessionRepository.findTopByRegistryInstitutionIdOrderByCreatedAtDesc(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(storedSession.get()));

        OtpPolicy policy = new OtpPolicy(300, 5, 60, 15, 30, 15, "unit-test-otp-secret", "unit-test-jwt-secret-0123456789");
        InstitutionAccessService accessService = new InstitutionAccessService(registryService, institutionRepository);

        service = new InstitutionVerificationService(
                accessService,
                registryService,
                institutionRepository,
                sessionRepository,
                mock(AdminRepository.class),
                policy,
                mailService,
                new AdminNonceService(),
                new WalletSignatureVerifier(),
                mock(JwtService.class),
                mock(AuditLogService.class),
                mock(LegacyDataAdopter.class),
                true);
    }

    /** Sends an OTP and returns the plaintext code that was handed to the mail service. */
    private String sendAndCaptureOtp(InstitutionOtpSentResponse[] responseOut) {
        InstitutionOtpSentResponse response = service.sendOtp("demo-1001");
        responseOut[0] = response;
        ArgumentCaptor<String> otp = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendCollegeAdminOtp(eq(HOI_EMAIL), eq("Greenfield Institute of Technology"),
                otp.capture(), any(Duration.class));
        return otp.getValue();
    }

    @Test
    void lookupReturnsRegistryDetailsWithMaskedEmail() {
        InstitutionLookupResponse response = service.lookup("  demo-1001 ");

        assertThat(response.institutionId()).isEqualTo("DEMO-1001");
        assertThat(response.name()).isEqualTo("Greenfield Institute of Technology");
        assertThat(response.state()).isEqualTo("Karnataka");
        assertThat(response.district()).isEqualTo("Bengaluru Urban");
        assertThat(response.hoiEmail()).isEqualTo("h**@greenfield.example").doesNotContain("hoi@");
        assertThat(response.alreadyRegistered()).isFalse();
    }

    @Test
    void unknownInstitutionAsksToRegisterInTheRegistryFirst() {
        when(registryService.findInstitution(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lookup("NOPE-0000"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("INSTITUTION_NOT_FOUND");
                    assertThat(e.getMessage()).contains("register");
                });
    }

    @Test
    void pendingAndSuspendedInstitutionsCannotBeVerified() {
        registryRecord.set(registry(RegistryStatus.PENDING));
        assertThatThrownBy(() -> service.sendOtp("DEMO-1001"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INSTITUTION_PENDING"));

        registryRecord.set(registry(RegistryStatus.SUSPENDED));
        assertThatThrownBy(() -> service.sendOtp("DEMO-1001"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INSTITUTION_SUSPENDED"));

        verify(mailService, never()).sendCollegeAdminOtp(anyString(), anyString(), anyString(), any(Duration.class));
    }

    @Test
    void otpGoesToTheRegistryEmailAndIsNeverReturnedOrStoredInPlainText() {
        InstitutionOtpSentResponse[] response = new InstitutionOtpSentResponse[1];
        String otp = sendAndCaptureOtp(response);

        assertThat(otp).matches("^[0-9]{6}$");
        assertThat(response[0].toString()).doesNotContain(otp);
        assertThat(response[0].maskedEmail()).isEqualTo("h**@greenfield.example");
        assertThat(response[0].expiresInSeconds()).isEqualTo(300);
        assertThat(response[0].resendAvailableInSeconds()).isEqualTo(60);

        InstitutionVerificationSession session = storedSession.get();
        assertThat(session.getOtpHash()).doesNotContain(otp);
        assertThat(session.getStatus()).isEqualTo(VerificationSessionStatus.OTP_SENT);
        assertThat(session.getExpiresAt()).isAfter(Instant.now().plusSeconds(290));
    }

    @Test
    void correctOtpVerifiesTheInstitutionAndCannotBeReused() {
        InstitutionOtpSentResponse[] response = new InstitutionOtpSentResponse[1];
        String otp = sendAndCaptureOtp(response);

        InstitutionOtpVerifyResponse verified = service.verifyOtp(response[0].sessionId(), otp);
        assertThat(verified.verified()).isTrue();
        assertThat(verified.institution().institutionId()).isEqualTo("DEMO-1001");
        assertThat(verified.institution().verified()).isTrue();

        assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), otp))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("OTP_ALREADY_USED"));
    }

    @Test
    void fiveWrongAttemptsLockTheOtpEvenForTheCorrectCode() {
        InstitutionOtpSentResponse[] response = new InstitutionOtpSentResponse[1];
        String otp = sendAndCaptureOtp(response);
        String wrong = otp.equals("000000") ? "000001" : "000000";

        for (int i = 1; i <= 4; i++) {
            int attempt = i;
            assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), wrong))
                    .isInstanceOfSatisfying(ApiException.class, e -> {
                        assertThat(e.getCode()).isEqualTo("OTP_INVALID");
                        assertThat(e.getMessage()).contains((5 - attempt) + " attempt");
                    });
        }
        assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), wrong))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("OTP_LOCKED"));

        // The right code no longer works: the OTP was invalidated by the failed attempts.
        assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), otp))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("OTP_EXPIRED"));
    }

    @Test
    void expiredOtpIsRejected() {
        InstitutionOtpSentResponse[] response = new InstitutionOtpSentResponse[1];
        String otp = sendAndCaptureOtp(response);
        storedSession.get().setExpiresAt(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), otp))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("OTP_EXPIRED"));
    }

    @Test
    void resendWithinSixtySecondsIsRefusedWithRetryAfter() {
        service.sendOtp("DEMO-1001");

        assertThatThrownBy(() -> service.sendOtp("DEMO-1001"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("RESEND_COOLDOWN");
                    assertThat(e.getRetryAfterSeconds()).isBetween(1, 60);
                });
    }

    @Test
    void institutionSuspendedMidFlowCannotFinishVerification() {
        InstitutionOtpSentResponse[] response = new InstitutionOtpSentResponse[1];
        String otp = sendAndCaptureOtp(response);

        registryRecord.set(registry(RegistryStatus.SUSPENDED));

        assertThatThrownBy(() -> service.verifyOtp(response[0].sessionId(), otp))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("INSTITUTION_SUSPENDED"));
    }

    @Test
    void alreadyRegisteredInstitutionCannotRegisterAgain() {
        Institution existing = new Institution();
        existing.setRegistryInstitutionId("DEMO-1001");
        existing.setVerified(true);
        existing.setWalletAddress("0xab07a51fd2dabccef287f0d3ffbce0a6d3297c3b");
        when(institutionRepository.findByRegistryInstitutionId("DEMO-1001")).thenReturn(Optional.of(existing));

        assertThat(service.lookup("DEMO-1001").alreadyRegistered()).isTrue();
        assertThatThrownBy(() -> service.sendOtp("DEMO-1001"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo("ALREADY_REGISTERED"));
    }
}
