package com.kredent.backend.registry;

import com.kredent.backend.config.OtpPolicy;
import com.kredent.backend.exception.ApiException;
import com.kredent.backend.registry.dto.RegistryAdminLoginResponse;
import com.kredent.backend.registry.dto.RegistryInstitutionView;
import com.kredent.backend.registry.dto.RegistryLogView;
import com.kredent.backend.registry.dto.RegistryOtpSentResponse;
import com.kredent.backend.registry.dto.RegistryRegisterRequest;
import com.kredent.backend.registry.dto.RegistryRegisterResponse;
import com.kredent.backend.security.JwtService;
import com.kredent.backend.service.OtpMailService;
import com.kredent.backend.util.OtpUtil;
import com.kredent.backend.util.SecurityConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Business rules of the simulated institutional registry.
 *
 * DEMONSTRATION ONLY — this is not an AICTE service and is not connected to AICTE or any
 * government system. It exists so Kredent can demonstrate verifying a college against an external
 * registry before it is allowed to issue certificates.
 */
@Service
public class RegistryService {

    private static final Logger log = LoggerFactory.getLogger(RegistryService.class);

    private static final Pattern HAS_LETTER = Pattern.compile(".*\\p{L}.*");
    private static final Pattern HAS_DIGIT = Pattern.compile(".*[0-9].*");

    private final RegistryRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final OtpPolicy otpPolicy;
    private final OtpMailService mailService;
    private final JwtService jwtService;
    private final RegistryLoginLimiter loginLimiter;
    /** A real BCrypt hash, only ever compared against when the account does not exist. */
    private final String dummyHash;

    public RegistryService(
            RegistryRepository repository,
            PasswordEncoder passwordEncoder,
            OtpPolicy otpPolicy,
            OtpMailService mailService,
            JwtService jwtService,
            RegistryLoginLimiter loginLimiter) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.otpPolicy = otpPolicy;
        this.mailService = mailService;
        this.jwtService = jwtService;
        this.loginLimiter = loginLimiter;
        this.dummyHash = passwordEncoder.encode(OtpUtil.newSalt());
    }

    // ------------------------------------------------------------------ lookups used by Kredent

    /** Normalises an institutional ID the same way registration does (trim + upper-case). */
    public static String normalizeInstitutionId(String raw) {
        return raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
    }

    public Optional<RegistryInstitution> findInstitution(String rawInstitutionId) {
        String id = normalizeInstitutionId(rawInstitutionId);
        if (id.isEmpty()) {
            return Optional.empty();
        }
        return repository.findByInstitutionId(id);
    }

    /** Writes an audit row for events that happen on Kredent's side (lookups, OTPs, completions). */
    public void recordVerificationEvent(String institutionId, String event, String detail) {
        try {
            repository.log(institutionId, event, detail);
        } catch (DataAccessException e) {
            // Logging must never break the flow being logged.
            log.warn("Could not write registry verification log ({})", e.getClass().getSimpleName());
        }
    }

    // ------------------------------------------------------------------ college registration

    private static final java.security.SecureRandom ID_RANDOM = new java.security.SecureRandom();

    /** Issues a unique institutional ID such as KR-2026-48213 (year + 5 random digits, re-drawn on collision). */
    private String generateInstitutionId() {
        int year = java.time.Year.now().getValue();
        for (int attempt = 0; attempt < 20; attempt++) {
            String candidate = "KR-%d-%05d".formatted(year, ID_RANDOM.nextInt(100_000));
            if (repository.findByInstitutionId(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ID_GENERATION_FAILED",
                "Could not issue an institutional ID right now. Please try again.");
    }

    public RegistryRegisterResponse register(RegistryRegisterRequest request) {
        if (!request.password().equals(request.confirmPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_MISMATCH", "Password and confirm password do not match.");
        }
        if (!HAS_LETTER.matcher(request.password()).matches() || !HAS_DIGIT.matcher(request.password()).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD",
                    "Password must be at least 8 characters and include a letter and a number.");
        }

        String institutionId = generateInstitutionId();
        String email = request.officialEmail().trim().toLowerCase(Locale.ROOT);

        if (repository.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN",
                    "This email address is already registered. If you have not received your institutional ID yet, use Verify Email.");
        }

        RegistryInstitution institution = new RegistryInstitution(
                0L,
                institutionId,
                clean(request.collegeName()),
                clean(request.state()),
                clean(request.district()),
                clean(request.hoiName()),
                email,
                request.contactNumber().trim(),
                passwordEncoder.encode(request.password()),
                RegistryStatus.PENDING,
                false,
                Instant.now());

        try {
            repository.insert(institution, false);
        } catch (DataAccessException e) {
            // A concurrent registration can slip past the pre-checks above; the UNIQUE constraints
            // are the real guarantee.
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED",
                    "This institution ID or email address is already registered.");
        }
        repository.log(institutionId, "REGISTERED", "College registered; ID reserved; status PENDING until e-mail verified");

        boolean emailSent = false;
        try {
            issueEmailOtp(repository.findByInstitutionId(institutionId).orElseThrow(), true);
            emailSent = true;
        } catch (ApiException e) {
            // Registration itself succeeded; the college can request the code again on the verification page.
            repository.log(institutionId, "EMAIL_OTP_FAILED", e.getCode());
        }

        return new RegistryRegisterResponse(RegistryStatus.PENDING.name(), emailSent, email,
                emailSent
                        ? "Enter the verification code sent to your official email to receive your institutional ID."
                        : "Registration received, but the verification email could not be sent. Request a new code on the next page.");
    }

    // ------------------------------------------------------------------ registry email verification

    private Optional<RegistryInstitution> findByRawEmail(String rawEmail) {
        return repository.findByEmail(rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT));
    }

    public RegistryOtpSentResponse resendEmailOtp(String rawEmail) {
        RegistryInstitution institution = findByRawEmail(rawEmail)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INSTITUTION_NOT_FOUND",
                        "No institution is registered with this ID."));
        if (institution.emailVerified()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_VERIFIED", "This email address is already verified.");
        }
        return issueEmailOtp(institution, false);
    }

    private RegistryOtpSentResponse issueEmailOtp(RegistryInstitution institution, boolean firstSend) {
        Optional<RegistryRepository.EmailOtp> latest = repository.findLatestOtp(institution.pk());
        if (!firstSend && latest.isPresent()) {
            long sinceLast = Duration.between(latest.get().sentAt(), Instant.now()).getSeconds();
            long wait = otpPolicy.resendCooldown().getSeconds() - sinceLast;
            if (wait > 0) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESEND_COOLDOWN",
                        "Please wait " + wait + " seconds before requesting another code.", (int) wait);
            }
        }

        String otp = OtpUtil.generateOtp();
        String salt = OtpUtil.newSalt();
        String hash = OtpUtil.hash(otp, salt, emailContext(institution), otpPolicy.secret());

        // Send first: if the mail cannot be delivered nothing is stored, so a failed attempt does not start
        // the resend cooldown or invalidate a code the college already holds.
        mailService.sendRegistryEmailOtp(institution.officialEmail(), institution.collegeName(), otp, otpPolicy.ttl());

        // Previous codes stop working the moment a new one is issued.
        repository.consumeAllOtps(institution.pk());
        repository.insertOtp(institution.pk(), hash, salt, Instant.now().plus(otpPolicy.ttl()));
        repository.log(institution.institutionId(), "EMAIL_OTP_SENT", "Registry email verification code sent");

        return new RegistryOtpSentResponse(
                OtpUtil.maskEmail(institution.officialEmail()),
                (int) otpPolicy.ttl().getSeconds(),
                (int) otpPolicy.resendCooldown().getSeconds());
    }

    /** Verifies the e-mail code and returns the institutional ID — the only point at which it is handed out. */
    public String verifyEmailOtp(String rawEmail, String otp) {
        RegistryInstitution institution = findByRawEmail(rawEmail)
                .orElseThrow(() -> invalidCode());
        if (institution.emailVerified()) {
            approveIfPending(institution); // idempotent
            return institution.institutionId();
        }
        RegistryRepository.EmailOtp stored = repository.findLatestOtp(institution.pk())
                .filter(o -> o.consumedAt() == null)
                .orElseThrow(() -> new ApiException(HttpStatus.GONE, "OTP_EXPIRED",
                        "This code is no longer valid. Request a new one."));

        if (Instant.now().isAfter(stored.expiresAt())) {
            repository.consumeOtp(stored.id());
            throw new ApiException(HttpStatus.GONE, "OTP_EXPIRED", "This code has expired. Request a new one.");
        }
        if (stored.attempts() >= otpPolicy.maxAttempts()) {
            repository.consumeOtp(stored.id());
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_LOCKED",
                    "Too many incorrect attempts. Request a new code.");
        }

        if (!OtpUtil.matches(otp, stored.salt(), emailContext(institution), otpPolicy.secret(), stored.otpHash())) {
            repository.incrementOtpAttempts(stored.id());
            int remaining = otpPolicy.maxAttempts() - (stored.attempts() + 1);
            repository.log(institution.institutionId(), "EMAIL_OTP_WRONG", "attempt " + (stored.attempts() + 1));
            if (remaining <= 0) {
                repository.consumeOtp(stored.id());
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "OTP_LOCKED",
                        "Too many incorrect attempts. Request a new code.");
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
                    "Incorrect code. " + remaining + (remaining == 1 ? " attempt" : " attempts") + " remaining.");
        }

        repository.consumeOtp(stored.id()); // single use
        repository.markEmailVerified(institution.pk());
        repository.log(institution.institutionId(), "EMAIL_VERIFIED", "Official email verified");
        approveIfPending(institution);
        return institution.institutionId();
    }

    /** Verifying the official email is the only requirement: a PENDING institution becomes APPROVED. A SUSPENDED one stays suspended. */
    private void approveIfPending(RegistryInstitution institution) {
        if (institution.status() == RegistryStatus.PENDING) {
            repository.updateStatus(institution.pk(), RegistryStatus.APPROVED);
            repository.log(institution.institutionId(), "AUTO_APPROVED", "Approved automatically after e-mail verification");
        }
    }

    private static ApiException invalidCode() {
        // Same answer for "unknown institution" and "wrong code" so this endpoint cannot be used to
        // probe which institution IDs exist.
        return new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Incorrect or expired code.");
    }

    private static String emailContext(RegistryInstitution institution) {
        return "registry-email:" + institution.pk() + ":" + institution.institutionId();
    }

    // ------------------------------------------------------------------ registry administrator

    public RegistryAdminLoginResponse adminLogin(String rawEmail, String password) {
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        int locked = loginLimiter.secondsLocked(email);
        if (locked > 0) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_LOCKED",
                    "Too many failed sign-in attempts. Try again in " + locked + " seconds.", locked);
        }

        Optional<RegistryRepository.RegistryAdmin> admin = repository.findAdminByEmail(email);
        // Compare against a dummy hash when the account does not exist so timing does not reveal it.
        String hash = admin.map(RegistryRepository.RegistryAdmin::passwordHash).orElse(dummyHash);
        boolean ok = passwordEncoder.matches(password, hash) && admin.isPresent();
        if (!ok) {
            loginLimiter.recordFailure(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password.");
        }
        loginLimiter.recordSuccess(email);

        String token = jwtService.generateToken(admin.get().email(), SecurityConstants.ROLE_REGISTRY_ADMIN, admin.get().id());
        return new RegistryAdminLoginResponse(token, admin.get().email());
    }

    /** Approved institutions only — the public college picker. Contact details are not exposed by callers. */
    public List<RegistryInstitution> listApproved() {
        return repository.findAll().stream().filter(i -> i.status() == RegistryStatus.APPROVED).toList();
    }

    public List<RegistryInstitutionView> listInstitutions() {
        return repository.findAll().stream().map(RegistryInstitutionView::from).toList();
    }

    public List<RegistryLogView> recentLogs() {
        return repository.recentLogs(100).stream()
                .map(l -> new RegistryLogView(l.id(), l.institutionId(), l.event(), l.detail(), l.createdAt()))
                .toList();
    }

    public RegistryInstitutionView approve(String rawInstitutionId, String adminEmail) {
        RegistryInstitution institution = requireInstitution(rawInstitutionId);
        if (!institution.emailVerified()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_NOT_VERIFIED",
                    "The institution's official email must be verified before it can be approved.");
        }
        repository.updateStatus(institution.pk(), RegistryStatus.APPROVED);
        repository.log(institution.institutionId(), "APPROVED", "by " + adminEmail);
        return RegistryInstitutionView.from(requireInstitution(rawInstitutionId));
    }

    public RegistryInstitutionView suspend(String rawInstitutionId, String adminEmail) {
        RegistryInstitution institution = requireInstitution(rawInstitutionId);
        repository.updateStatus(institution.pk(), RegistryStatus.SUSPENDED);
        repository.log(institution.institutionId(), "SUSPENDED", "by " + adminEmail);
        return RegistryInstitutionView.from(requireInstitution(rawInstitutionId));
    }

    private RegistryInstitution requireInstitution(String rawInstitutionId) {
        return findInstitution(rawInstitutionId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INSTITUTION_NOT_FOUND", "Institution not found."));
    }

    /** Trim and collapse runs of whitespace; control characters are dropped. */
    private static String clean(String value) {
        return value == null ? "" : value.replaceAll("\\p{Cntrl}", "").trim().replaceAll("\\s{2,}", " ");
    }
}
