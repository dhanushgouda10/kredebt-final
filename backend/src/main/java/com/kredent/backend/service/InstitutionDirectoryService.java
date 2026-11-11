package com.kredent.backend.service;

import com.kredent.backend.dto.CollegeOption;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.repository.InstitutionRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** The public list of colleges registered (and approved) in the institutional registry. */
@Service
public class InstitutionDirectoryService {

    private final RegistryService registryService;
    private final InstitutionRepository institutionRepository;

    public InstitutionDirectoryService(RegistryService registryService, InstitutionRepository institutionRepository) {
        this.registryService = registryService;
        this.institutionRepository = institutionRepository;
    }

    /**
     * Approved registry institutions, optionally filtered by a name / state / district fragment.
     * Pending and suspended institutions are never listed.
     */
    public List<CollegeOption> listColleges(String search) {
        Set<String> joined = institutionRepository.findAll().stream()
                .filter(Institution::isOnboarded)
                .map(Institution::getRegistryInstitutionId)
                .collect(Collectors.toSet());
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return registryService.listApproved().stream()
                .filter(i -> q.isEmpty()
                        || i.collegeName().toLowerCase(Locale.ROOT).contains(q)
                        || i.state().toLowerCase(Locale.ROOT).contains(q)
                        || i.district().toLowerCase(Locale.ROOT).contains(q))
                .map(i -> new CollegeOption(i.institutionId(), i.collegeName(), i.state(), i.district(),
                        joined.contains(i.institutionId())))
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }
}
