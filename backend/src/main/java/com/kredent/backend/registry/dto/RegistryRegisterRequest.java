package com.kredent.backend.registry.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** College self-registration in the institutional registry. The registry issues the institutional ID itself, so none is submitted here. Every field is validated again server-side. */
public record RegistryRegisterRequest(
        @NotBlank @Size(min = 3, max = 150)
        @Pattern(regexp = "^[\\p{L}0-9 .,&'()/-]+$", message = "may contain only letters, digits and . , & ' ( ) / -")
        String collegeName,

        @NotBlank @Size(max = 80)
        @Pattern(regexp = "^[\\p{L} .'()-]+$", message = "contains invalid characters")
        String state,

        @NotBlank @Size(max = 80)
        @Pattern(regexp = "^[\\p{L} .'()-]+$", message = "contains invalid characters")
        String district,

        @NotBlank @Size(max = 100)
        @Pattern(regexp = "^[\\p{L} .'-]+$", message = "contains invalid characters")
        String hoiName,

        @NotBlank @Email @Size(max = 254)
        String officialEmail,

        @NotBlank
        @Pattern(regexp = "^\\+?[0-9][0-9 -]{7,14}$", message = "must be a valid phone number")
        String contactNumber,

        // BCrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated.
        @NotBlank @Size(min = 8, max = 72)
        String password,

        @NotBlank
        String confirmPassword) {
}
