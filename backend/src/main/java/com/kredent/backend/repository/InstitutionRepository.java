package com.kredent.backend.repository;

import com.kredent.backend.entity.Institution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InstitutionRepository extends JpaRepository<Institution, Long> {

    Optional<Institution> findByRegistryInstitutionId(String registryInstitutionId);
}
