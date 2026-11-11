package com.kredent.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Single source of truth for OTP rules, shared by the Kredent college-admin verification and the
 * simulated registry's email verification. Defaults: valid 5 minutes, 5 wrong attempts, 60 second
 * resend cooldown (see application.properties).
 */
@Component
public class OtpPolicy {

    private final Duration ttl;
    private final int maxAttempts;
    private final Duration resendCooldown;
    private final int maxFailuresPerWindow;
    private final Duration failureWindow;
    private final Duration verifiedSessionValidity;
    private final String secret;

    public OtpPolicy(
            @Value("${otp.ttl-seconds:300}") long ttlSeconds,
            @Value("${otp.max-attempts:5}") int maxAttempts,
            @Value("${otp.resend-cooldown-seconds:60}") long cooldownSeconds,
            @Value("${otp.max-failures-per-window:15}") int maxFailuresPerWindow,
            @Value("${otp.failure-window-minutes:30}") long failureWindowMinutes,
            @Value("${otp.verified-session-minutes:15}") long verifiedSessionMinutes,
            @Value("${otp.hmac-secret:}") String hmacSecret,
            @Value("${jwt.secret}") String jwtSecret) {
        this.ttl = Duration.ofSeconds(ttlSeconds);
        this.maxAttempts = maxAttempts;
        this.resendCooldown = Duration.ofSeconds(cooldownSeconds);
        this.maxFailuresPerWindow = maxFailuresPerWindow;
        this.failureWindow = Duration.ofMinutes(failureWindowMinutes);
        this.verifiedSessionValidity = Duration.ofMinutes(verifiedSessionMinutes);
        this.secret = (hmacSecret == null || hmacSecret.isBlank()) ? jwtSecret : hmacSecret;
    }

    public Duration ttl() {
        return ttl;
    }

    public int maxAttempts() {
        return maxAttempts;
    }

    public Duration resendCooldown() {
        return resendCooldown;
    }

    public int maxFailuresPerWindow() {
        return maxFailuresPerWindow;
    }

    public Duration failureWindow() {
        return failureWindow;
    }

    public Duration verifiedSessionValidity() {
        return verifiedSessionValidity;
    }

    public String secret() {
        return secret;
    }
}
