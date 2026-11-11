package com.kredent.backend.registry.dto;

/** Never carries the OTP itself — only timing information and a masked address. */
public record RegistryOtpSentResponse(String maskedEmail, int expiresInSeconds, int resendAvailableInSeconds) {
}
