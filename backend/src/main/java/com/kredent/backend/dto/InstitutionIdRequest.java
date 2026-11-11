package com.kredent.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Body for the lookup and "send OTP" calls — just the institutional ID (Demo AICTE PID). */
public record InstitutionIdRequest(
        @NotBlank
        @Pattern(regexp = "^\\s*[A-Za-z0-9][A-Za-z0-9-]{3,31}\\s*$", message = "is not a valid institutional ID")
        String institutionId) {
}
