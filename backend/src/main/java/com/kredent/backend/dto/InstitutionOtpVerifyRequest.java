package com.kredent.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record InstitutionOtpVerifyRequest(
        @NotNull UUID sessionId,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "must be a 6-digit code") String otp) {
}
