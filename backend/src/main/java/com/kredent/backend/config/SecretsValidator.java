package com.kredent.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Fails fast when production is started with development or missing secrets.
 *
 * Without this, a missing environment variable silently falls back to whatever
 * default is compiled in — and a JWT secret that is public in the repository makes
 * every token forgeable, while a known wallet-encryption secret makes every stored
 * student private key decryptable. Both failures are invisible at runtime, which is
 * exactly what makes them dangerous. Better to refuse to start.
 *
 * Runs in EVERY profile, deliberately. Under "prod" a problem is fatal. Elsewhere
 * it is a loud warning — because the genuinely dangerous scenario is deploying to a
 * real server and simply forgetting to set SPRING_PROFILES_ACTIVE=prod, in which
 * case a prod-only check would never execute and the development secret would be
 * used in production in total silence.
 */
@Component
public class SecretsValidator {

    private static final Logger log = LoggerFactory.getLogger(SecretsValidator.class);

    /** Minimum length for an HMAC secret to be worth anything. */
    private static final int MIN_SECRET_LENGTH = 32;

    /** Substrings that mark a value as a placeholder rather than a real secret. */
    private static final List<String> DEV_MARKERS =
            List.of("dev-only", "change-me", "changeme", "insecure", "example", "placeholder");

    private final Environment environment;
    private final String jwtSecret;
    private final String walletEncryptionSecret;
    private final String corsAllowedOrigins;

    public SecretsValidator(
            Environment environment,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${wallet.encryption-secret:}") String walletEncryptionSecret,
            @Value("${cors.allowed-origins:}") String corsAllowedOrigins) {
        this.environment = environment;
        this.jwtSecret = jwtSecret;
        this.walletEncryptionSecret = walletEncryptionSecret;
        this.corsAllowedOrigins = corsAllowedOrigins;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void validate() {
        List<String> problems = new ArrayList<>();

        checkSecret("JWT_SECRET", jwtSecret, problems);
        checkSecret("WALLET_ENCRYPTION_SECRET", walletEncryptionSecret, problems);

        if (corsAllowedOrigins != null && corsAllowedOrigins.toLowerCase(Locale.ROOT).contains("localhost")) {
            problems.add("CORS_ALLOWED_ORIGINS contains localhost, which should not be permitted in production");
        }

        boolean isProd = List.of(environment.getActiveProfiles()).contains("prod");

        if (problems.isEmpty()) {
            log.info("Secret validation passed ({} profile).", isProd ? "prod" : "non-prod");
            return;
        }

        // Names and reasons only — never the offending value.
        String detail = "  - " + String.join("\n  - ", problems);

        if (isProd) {
            throw new IllegalStateException(
                    "Refusing to start with an insecure production configuration:\n" + detail);
        }

        log.warn("""
                ***************************************************************
                INSECURE CONFIGURATION DETECTED (non-prod profile, so starting anyway)
                {}
                If this instance is reachable by anyone other than you, stop it and
                supply real secrets. Starting with SPRING_PROFILES_ACTIVE=prod turns
                these into a hard startup failure.
                ***************************************************************""", detail);
    }

    private static void checkSecret(String name, String value, List<String> problems) {
        if (value == null || value.isBlank()) {
            problems.add(name + " is not set");
            return;
        }
        if (value.length() < MIN_SECRET_LENGTH) {
            problems.add(name + " is shorter than " + MIN_SECRET_LENGTH + " characters");
        }
        String lower = value.toLowerCase(Locale.ROOT);
        for (String marker : DEV_MARKERS) {
            if (lower.contains(marker)) {
                problems.add(name + " looks like a development placeholder (contains \"" + marker + "\")");
                return;
            }
        }
    }
}
