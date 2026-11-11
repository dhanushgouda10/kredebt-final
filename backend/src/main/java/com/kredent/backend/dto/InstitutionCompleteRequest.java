package com.kredent.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Final registration step. The signature is MetaMask's personal_sign over the server-issued nonce,
 * proving the administrator controls the wallet being linked to the institution.
 */
public record InstitutionCompleteRequest(
        @NotNull UUID sessionId,
        @NotBlank String walletAddress,
        @NotBlank String signature) {
}
