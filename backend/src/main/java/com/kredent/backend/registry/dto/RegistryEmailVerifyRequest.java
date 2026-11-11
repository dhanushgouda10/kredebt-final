package com.kredent.backend.registry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistryEmailVerifyRequest(
        @NotBlank @jakarta.validation.constraints.Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "^[0-9]{6}$", message = "must be a 6-digit code") String otp) {
}
