package com.kredent.backend.dto;

import com.kredent.backend.entity.Institution;

import java.time.LocalDateTime;

/** What the frontend may know about an institution: identity, location and its linked wallet address. */
public record InstitutionSummary(
        Long id,
        String institutionId,
        String name,
        String state,
        String district,
        String walletAddress,
        boolean verified,
        LocalDateTime verifiedAt) {

    public static InstitutionSummary from(Institution i) {
        return new InstitutionSummary(i.getId(), i.getRegistryInstitutionId(), i.getName(), i.getState(),
                i.getDistrict(), i.getWalletAddress(), i.isVerified(), i.getVerifiedAt());
    }
}
