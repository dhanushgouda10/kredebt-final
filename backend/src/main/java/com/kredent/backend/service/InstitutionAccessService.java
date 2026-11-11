package com.kredent.backend.service;

import com.kredent.backend.entity.Institution;
import com.kredent.backend.exception.ApiException;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.registry.RegistryStatus;
import com.kredent.backend.repository.InstitutionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The single place that decides "may this institution use Kredent right now?".
 *
 * Nothing the browser says about verification is trusted. Every check re-reads the institution's
 * live status from the registry, so suspending a college there takes effect on its very next
 * request, and an unverified institution can never reach an admin endpoint.
 */
@Service
public class InstitutionAccessService {

    private final RegistryService registryService;
    private final InstitutionRepository institutionRepository;

    public InstitutionAccessService(RegistryService registryService, InstitutionRepository institutionRepository) {
        this.registryService = registryService;
        this.institutionRepository = institutionRepository;
    }

    /**
     * Looks the ID up in the registry and requires APPROVED status. Used before any OTP is sent or
     * accepted, and on every sign-in.
     */
    public RegistryInstitution requireApprovedInRegistry(String rawInstitutionId) {
        String id = RegistryService.normalizeInstitutionId(rawInstitutionId);
        if (id.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INSTITUTION_ID_REQUIRED", "Enter your institutional ID.");
        }
        RegistryInstitution registry = registryService.findInstitution(id).orElseThrow(() -> {
            registryService.recordVerificationEvent(id, "LOOKUP_NOT_FOUND", "Unknown institutional ID");
            return new ApiException(HttpStatus.NOT_FOUND, "INSTITUTION_NOT_FOUND",
                    "This institutional ID was not found. Please register your institution in the "
                            + "institutional registry first, then try again.");
        });

        RegistryStatus status = registry.status();
        if (status == RegistryStatus.PENDING) {
            registryService.recordVerificationEvent(id, "LOOKUP_PENDING", "Institution not yet approved");
            throw new ApiException(HttpStatus.FORBIDDEN, "INSTITUTION_PENDING",
                    "This institution has not completed email verification in the registry yet, so it has no institutional ID to use here.");
        }
        if (status == RegistryStatus.SUSPENDED) {
            registryService.recordVerificationEvent(id, "LOOKUP_SUSPENDED", "Institution suspended");
            throw new ApiException(HttpStatus.FORBIDDEN, "INSTITUTION_SUSPENDED",
                    "This institution is suspended in the registry and cannot be verified. Please contact the registry administrator.");
        }
        return registry;
    }

    /** Sign-in gate: the institution must be fully onboarded on Kredent AND still approved in the registry. */
    public Institution requireActiveByRegistryId(String rawInstitutionId) {
        RegistryInstitution registry = requireApprovedInRegistry(rawInstitutionId);
        Institution institution = institutionRepository.findByRegistryInstitutionId(registry.institutionId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "INSTITUTION_NOT_REGISTERED",
                        "This institution has not completed Kredent verification yet. Complete first-time verification first."));
        assertOnboarded(institution);
        return institution;
    }

    /** Per-request gate for every admin API call (see AdminInstitutionGuardFilter). */
    public Institution requireActiveById(Long institutionId) {
        Institution institution = institutionRepository.findById(institutionId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "INSTITUTION_NOT_REGISTERED",
                        "This session is not linked to a verified institution."));
        assertOnboarded(institution);
        requireApprovedInRegistry(institution.getRegistryInstitutionId());
        return institution;
    }

    private static void assertOnboarded(Institution institution) {
        if (!institution.isOnboarded()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "INSTITUTION_NOT_VERIFIED",
                    "This institution has not completed verification. Verify the HOI email and connect a wallet first.");
        }
    }
}
