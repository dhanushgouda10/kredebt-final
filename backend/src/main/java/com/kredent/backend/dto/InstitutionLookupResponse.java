package com.kredent.backend.dto;

/**
 * Registry details shown after the administrator enters an institutional ID. The HOI email is the
 * one on file in the registry — it is displayed (masked by default) but the client can never
 * supply a different one: OTPs are always sent to the registry's address.
 */
public record InstitutionLookupResponse(
        String institutionId,
        String name,
        String state,
        String district,
        String hoiEmail,
        boolean hoiEmailMasked,
        boolean alreadyRegistered) {
}
