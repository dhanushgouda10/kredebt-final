package com.kredent.backend.registry.dto;

import com.kredent.backend.registry.RegistryInstitution;

import java.time.Instant;

/** Registry-admin view of an institution. Deliberately has no password hash. */
public record RegistryInstitutionView(
        String institutionId,
        String collegeName,
        String state,
        String district,
        String hoiName,
        String officialEmail,
        String contactNumber,
        String status,
        boolean emailVerified,
        Instant createdAt) {

    public static RegistryInstitutionView from(RegistryInstitution i) {
        return new RegistryInstitutionView(i.institutionId(), i.collegeName(), i.state(), i.district(),
                i.hoiName(), i.officialEmail(), i.contactNumber(), i.status().name(), i.emailVerified(), i.createdAt());
    }
}
