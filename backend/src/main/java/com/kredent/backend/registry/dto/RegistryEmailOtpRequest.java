package com.kredent.backend.registry.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistryEmailOtpRequest(@NotBlank @jakarta.validation.constraints.Email @Size(max = 254) String email) {
}
