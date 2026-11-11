package com.kredent.backend.util;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Generation and hashing of one-time passcodes.
 *
 * A six-digit code has only a million possibilities, so a plain SHA-256 of it would be reversed
 * instantly if the database leaked. Each code is therefore stored as an HMAC-SHA256 keyed with a
 * server-side secret, salted per OTP, and bound to a context string (institution + session) so a
 * hash can never be replayed against a different institution or session.
 */
public final class OtpUtil {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int OTP_BOUND = 1_000_000;

    private OtpUtil() {
        // no instances
    }

    /** Uniformly random six-digit code (leading zeros kept), from a cryptographically secure RNG. */
    public static String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(OTP_BOUND));
    }

    public static String newSalt() {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(salt);
    }

    public static String hash(String otp, String salt, String context, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((salt + "|" + context + "|" + otp).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException e) {
            // HmacSHA256 is guaranteed on every JVM; reaching this means a broken runtime.
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }

    /** Constant-time comparison, so response timing reveals nothing about how many digits matched. */
    public static boolean matches(String otp, String salt, String context, String secret, String expectedHash) {
        if (otp == null || expectedHash == null) {
            return false;
        }
        byte[] actual = hash(otp, salt, context, secret).getBytes(StandardCharsets.UTF_8);
        byte[] expected = expectedHash.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(actual, expected);
    }

    /** "a***@college.edu" — enough for the owner to recognise the mailbox, useless to anyone else. */
    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "";
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String domain = email.substring(at);
        if (local.length() <= 1) {
            return "*" + domain;
        }
        return local.charAt(0) + "*".repeat(Math.min(local.length() - 1, 6)) + domain;
    }
}
