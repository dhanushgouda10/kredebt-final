package com.kredent.backend.service;

import com.kredent.backend.config.OtpPolicy;
import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.InstitutionLookupResponse;
import com.kredent.backend.dto.InstitutionOtpSentResponse;
import com.kredent.backend.dto.InstitutionOtpVerifyResponse;
import com.kredent.backend.dto.InstitutionSummary;
import com.kredent.backend.entity.ActorType;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.InstitutionVerificationSession;
import com.kredent.backend.entity.Role;
import com.kredent.backend.entity.VerificationSessionStatus;
import com.kredent.backend.exception.ApiException;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.repository.InstitutionVerificationSessionRepository;
import com.kredent.backend.security.JwtService;
import com.kredent.backend.util.OtpUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * College-administrator onboarding: institutional ID -> registry lookup -> email OTP -> wallet.
 *
 * Security properties (each enforced here on the server, never by the UI):
 *  - the OTP goes only to the HOI email stored in the registry; the client cannot choose an address
 *  - six digits from a SecureRandom, stored only as a salted HMAC bound to institution + session
 *  - valid for otp.ttl-seconds (5 min), single use, 5 wrong attempts per OTP, plus a cap on wrong
 *    attempts across all of an institution's recent OTPs so resending cannot reset the guess budget
 *  - 60 second resend cooldown, previous OTPs invalidated when a new one is issued
 *  - registry status (APPROVED) is re-checked at every step, not just at lookup
 *  - the OTP itself never appears in a response, log line or exception message
 */
@Service
public class InstitutionVerificationService {

    private final InstitutionAccessService accessService;
    private final RegistryService registryService;
    private final InstitutionRepository institutionRepository;
    private final InstitutionVerificationSessionRepository sessionRepository;
    private final AdminRepository adminRepository;
    private final OtpPolicy otpPolicy;
    private final OtpMailService mailService;
    private final AdminNonceService nonceService;
    private final WalletSignatureVerifier signatureVerifier;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final LegacyDataAdopter legacyDataAdopter;
    private final boolean maskHoiEmail;

    public InstitutionVerificationService(
            InstitutionAccessService accessService,
            RegistryService registryService,
            InstitutionRepository institutionRepository,
            InstitutionVerificationSessionRepository sessionRepository,
            AdminRepository adminRepository,
            OtpPolicy otpPolicy,
            OtpMailService mailService,
            AdminNonceService nonceService,
            WalletSignatureVerifier signatureVerifier,
            JwtService jwtService,
            AuditLogService auditLogService,
            LegacyDataAdopter legacyDataAdopter,
            @Value("${institution.mask-hoi-email:true}") boolean maskHoiEmail) {
        this.accessService = accessService;
        this.registryService = registryService;
        this.institutionRepository = institutionRepository;
        this.sessionRepository = sessionRepository;
        this.adminRepository = adminRepository;
        this.otpPolicy = otpPolicy;
        this.mailService = mailService;
        this.nonceService = nonceService;
        this.signatureVerifier = signatureVerifier;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
        this.legacyDataAdopter = legacyDataAdopter;
        this.maskHoiEmail = maskHoiEmail;
    }

    // ------------------------------------------------------------------ step 1-2: lookup

    /** Fetches the registered details for an institutional ID (APPROVED institutions only). */
    public InstitutionLookupResponse lookup(String rawInstitutionId) {
        RegistryInstitution registry = accessService.requireApprovedInRegistry(rawInstitutionId);
        boolean alreadyRegistered = institutionRepository.findByRegistryInstitutionId(registry.institutionId())
                .map(Institution::isOnboarded)
                .orElse(false);

        registryService.recordVerificationEvent(registry.institutionId(), "LOOKUP_OK", "Details retrieved by Kredent");
        return new InstitutionLookupResponse(
                registry.institutionId(),
                registry.collegeName(),
                registry.state(),
                registry.district(),
                maskHoiEmail ? OtpUtil.maskEmail(registry.officialEmail()) : registry.officialEmail(),
                maskHoiEmail,
                alreadyRegistered);
    }

    // ------------------------------------------------------------------ step 3: send OTP

    /**
     * Issues a new OTP to the registry's HOI email. A mail failure throws, which rolls this
     * transaction back: the previous OTP (if any) stays valid and the cooldown is not consumed.
     */
    @Transactional
    public InstitutionOtpSentResponse sendOtp(String rawInstitutionId) {
        RegistryInstitution registry = accessService.requireApprovedInRegistry(rawInstitutionId);
        String institutionId = registry.institutionId();
        Instant now = Instant.now();

        Optional<Institution> existing = institutionRepository.findByRegistryInstitutionId(institutionId);
        if (existing.isPresent() && existing.get().isOnboarded()) {
            throw alreadyRegistered();
        }

        long failures = sessionRepository.sumAttemptsSince(institutionId, now.minus(otpPolicy.failureWindow()));
        if (failures >= otpPolicy.maxFailuresPerWindow()) {
            int wait = (int) otpPolicy.failureWindow().getSeconds();
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Too many incorrect codes were entered for this institution. Please try again later.", wait);
        }

        Optional<InstitutionVerificationSession> latest =
                sessionRepository.findTopByRegistryInstitutionIdOrderByCreatedAtDesc(institutionId);
        if (latest.isPresent()) {
            long wait = otpPolicy.resendCooldown().getSeconds()
                    - Duration.between(latest.get().getCreatedAt(), now).getSeconds();
            if (wait > 0) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESEND_COOLDOWN",
                        "Please wait " + wait + " seconds before requesting another code.", (int) wait);
            }
        }

        UUID sessionId = UUID.randomUUID();
        String otp = OtpUtil.generateOtp();
        String salt = OtpUtil.newSalt();

        InstitutionVerificationSession session = new InstitutionVerificationSession();
        session.setId(sessionId);
        session.setRegistryInstitutionId(institutionId);
        session.setOtpSalt(salt);
        session.setOtpHash(OtpUtil.hash(otp, salt, context(sessionId, institutionId), otpPolicy.secret()));
        session.setStatus(VerificationSessionStatus.OTP_SENT);
        session.setAttempts(0);
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(otpPolicy.ttl()));

        // Older codes stop working the moment a new one exists.
        sessionRepository.invalidateOpenOtps(institutionId);
        sessionRepository.save(session);

        try {
            mailService.sendCollegeAdminOtp(registry.officialEmail(), registry.collegeName(), otp, otpPolicy.ttl());
        } catch (ApiException e) {
            registryService.recordVerificationEvent(institutionId, "OTP_EMAIL_FAILED", e.getCode());
            throw e;
        }
        registryService.recordVerificationEvent(institutionId, "OTP_SENT", "Code emailed to the registered HOI address");

        return new InstitutionOtpSentResponse(
                sessionId,
                OtpUtil.maskEmail(registry.officialEmail()),
                (int) otpPolicy.ttl().getSeconds(),
                (int) otpPolicy.resendCooldown().getSeconds());
    }

    // ------------------------------------------------------------------ step 4: verify OTP

    /**
     * Wrong guesses must be persisted even though they end in an exception, hence noRollbackFor.
     * The session row is locked so concurrent requests cannot share one attempt counter value.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public InstitutionOtpVerifyResponse verifyOtp(UUID sessionId, String otp) {
        InstitutionVerificationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "SESSION_INVALID",
                        "This verification session was not found. Request a new code."));
        String institutionId = session.getRegistryInstitutionId();

        // Still approved? (A college suspended mid-flow must not be able to finish.)
        RegistryInstitution registry = accessService.requireApprovedInRegistry(institutionId);

        if (session.getStatus() == VerificationSessionStatus.VERIFIED
                || session.getStatus() == VerificationSessionStatus.COMPLETED) {
            throw new ApiException(HttpStatus.CONFLICT, "OTP_ALREADY_USED", "This code has already been used.");
        }
        if (session.getStatus() == VerificationSessionStatus.INVALIDATED) {
            throw new ApiException(HttpStatus.GONE, "OTP_EXPIRED",
                    "This code is no longer valid. Request a new one.");
        }

        Instant now = Instant.now();
        if (now.isAfter(session.getExpiresAt())) {
            session.setStatus(VerificationSessionStatus.INVALIDATED);
            sessionRepository.save(session);
            throw new ApiException(HttpStatus.GONE, "OTP_EXPIRED", "This code has expired. Request a new one.");
        }

        long recentFailures = sessionRepository.sumAttemptsSince(institutionId, now.minus(otpPolicy.failureWindow()));
        if (session.getAttempts() >= otpPolicy.maxAttempts() || recentFailures >= otpPolicy.maxFailuresPerWindow()) {
            session.setStatus(VerificationSessionStatus.INVALIDATED);
            sessionRepository.save(session);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_LOCKED",
                    "Too many incorrect attempts. Request a new code.");
        }

        boolean ok = OtpUtil.matches(otp, session.getOtpSalt(), context(sessionId, institutionId),
                otpPolicy.secret(), session.getOtpHash());
        if (!ok) {
            session.setAttempts(session.getAttempts() + 1);
            int remaining = otpPolicy.maxAttempts() - session.getAttempts();
            registryService.recordVerificationEvent(institutionId, "OTP_WRONG", "attempt " + session.getAttempts());
            if (remaining <= 0) {
                session.setStatus(VerificationSessionStatus.INVALIDATED);
                sessionRepository.save(session);
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_LOCKED",
                        "Too many incorrect attempts. Request a new code.");
            }
            sessionRepository.save(session);
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
                    "Incorrect code. " + remaining + (remaining == 1 ? " attempt" : " attempts") + " remaining.");
        }

        // Correct. The session is now VERIFIED — the code cannot be presented again.
        session.setStatus(VerificationSessionStatus.VERIFIED);
        session.setVerifiedAt(now);
        sessionRepository.save(session);

        Institution institution = institutionRepository.findByRegistryInstitutionId(institutionId)
                .orElseGet(Institution::new);
        if (institution.isOnboarded()) {
            throw alreadyRegistered();
        }
        institution.setRegistryInstitutionId(institutionId);
        institution.setName(registry.collegeName());
        institution.setState(registry.state());
        institution.setDistrict(registry.district());
        institution.setVerified(true);
        institution.setVerifiedAt(LocalDateTime.now());
        institutionRepository.save(institution);

        registryService.recordVerificationEvent(institutionId, "OTP_VERIFIED", "Institution verified on Kredent");
        return new InstitutionOtpVerifyResponse(true, InstitutionSummary.from(institution));
    }

    // ------------------------------------------------------------------ step 5: wallet + registration

    /**
     * Links the administrator's MetaMask wallet to the verified institution and signs them in.
     * Requires a VERIFIED session (so the OTP step cannot be skipped) and a signature over a
     * server-issued nonce (so the wallet cannot be claimed by someone who merely knows its address).
     */
    @Transactional
    public AuthResponse completeRegistration(UUID sessionId, String walletAddress, String signature) {
        InstitutionVerificationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "SESSION_INVALID",
                        "This verification session was not found. Start again."));
        String institutionId = session.getRegistryInstitutionId();
        RegistryInstitution registry = accessService.requireApprovedInRegistry(institutionId);

        if (session.getStatus() == VerificationSessionStatus.COMPLETED) {
            throw alreadyRegistered();
        }
        if (session.getStatus() != VerificationSessionStatus.VERIFIED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "OTP_NOT_VERIFIED",
                    "Verify the code sent to the registered email before connecting a wallet.");
        }
        Instant verifiedAt = session.getVerifiedAt() == null ? session.getCreatedAt() : session.getVerifiedAt();
        if (Instant.now().isAfter(verifiedAt.plus(otpPolicy.verifiedSessionValidity()))) {
            session.setStatus(VerificationSessionStatus.INVALIDATED);
            sessionRepository.save(session);
            throw new ApiException(HttpStatus.GONE, "SESSION_EXPIRED",
                    "This verification has expired. Please verify again.");
        }

        String address = walletAddress == null ? "" : walletAddress.trim();
        if (!WalletSignatureVerifier.isValidAddressFormat(address)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WALLET_INVALID", "Invalid wallet address.");
        }
        String challenge = nonceService.consume(address).orElseThrow(() ->
                new ApiException(HttpStatus.UNAUTHORIZED, "WALLET_CHALLENGE_MISSING",
                        "The wallet challenge expired. Please try connecting again."));
        if (!signatureVerifier.verifies(challenge, signature, address)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "WALLET_SIGNATURE_INVALID",
                    "The wallet signature could not be verified.");
        }

        Institution institution = institutionRepository.findByRegistryInstitutionId(institutionId)
                .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "INSTITUTION_NOT_VERIFIED",
                        "Verification is incomplete. Please start again."));
        if (institution.isOnboarded()) {
            throw alreadyRegistered();
        }

        String normalizedWallet = address.toLowerCase(Locale.ROOT);
        institution.setWalletAddress(normalizedWallet);
        institution.setWalletLinkedAt(LocalDateTime.now());
        institutionRepository.save(institution);
        legacyDataAdopter.adoptFor(institution);

        Admin admin = adminRepository.findByWalletAddress(normalizedWallet)
                .orElseGet(() -> createAdminFor(registry, normalizedWallet));

        session.setStatus(VerificationSessionStatus.COMPLETED);
        sessionRepository.save(session);

        auditLogService.record(ActorType.ADMIN, admin.getId(), "INSTITUTION_REGISTERED", "INSTITUTION",
                String.valueOf(institution.getId()),
                Map.of("institutionId", institutionId, "walletAddress", normalizedWallet));
        registryService.recordVerificationEvent(institutionId, "WALLET_LINKED", "Administrator wallet linked; institution registered");

        String token = jwtService.generateToken(admin.getWalletAddress(), Role.ADMIN.name(), admin.getId(), institution.getId());
        AuthResponse response = new AuthResponse(token, Role.ADMIN.name(), admin.getId(), admin.getFullName(), admin.getEmail());
        response.setInstitution(InstitutionSummary.from(institution));
        return response;
    }

    /** One Admin row per wallet; colleges that share a wallet in the demo share that row. */
    private Admin createAdminFor(RegistryInstitution registry, String wallet) {
        Admin admin = new Admin();
        admin.setFullName(registry.hoiName());
        String email = registry.officialEmail().toLowerCase(Locale.ROOT);
        if (adminRepository.existsByEmail(email)) {
            email = registry.institutionId().toLowerCase(Locale.ROOT) + "@institutions.kredent.local";
        }
        admin.setEmail(email);
        admin.setWalletAddress(wallet);
        return adminRepository.save(admin);
    }

    private static String context(UUID sessionId, String institutionId) {
        return "kredent-admin:" + institutionId + ":" + sessionId;
    }

    private static ApiException alreadyRegistered() {
        return new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED",
                "This institution is already registered on Kredent. Sign in with your administrator wallet instead.");
    }
}
