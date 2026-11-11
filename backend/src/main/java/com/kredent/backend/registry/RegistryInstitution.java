package com.kredent.backend.registry;

import java.time.Instant;

/**
 * One row of the simulated registry's institutions table. Includes the password hash, so it must
 * never be serialised to a client — API responses use the DTOs in registry.dto instead.
 */
public record RegistryInstitution(
        long pk,
        String institutionId,
        String collegeName,
        String state,
        String district,
        String hoiName,
        String officialEmail,
        String contactNumber,
        String passwordHash,
        RegistryStatus status,
        boolean emailVerified,
        Instant createdAt) {
}
