package com.kredent.backend.dto;

import java.util.UUID;

/** Contains NO OTP — only the session handle, a masked address and timings for the countdown UI. */
public record InstitutionOtpSentResponse(
        UUID sessionId,
        String maskedEmail,
        int expiresInSeconds,
        int resendAvailableInSeconds) {
}
