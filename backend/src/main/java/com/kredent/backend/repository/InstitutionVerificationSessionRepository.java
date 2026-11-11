package com.kredent.backend.repository;

import com.kredent.backend.entity.InstitutionVerificationSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface InstitutionVerificationSessionRepository extends JpaRepository<InstitutionVerificationSession, UUID> {

    /**
     * Row-locked read used when an OTP is checked or a session is completed, so two simultaneous
     * requests cannot both consume the same single-use session or both count as "attempt 1".
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from InstitutionVerificationSession s where s.id = :id")
    Optional<InstitutionVerificationSession> findByIdForUpdate(@Param("id") UUID id);

    Optional<InstitutionVerificationSession> findTopByRegistryInstitutionIdOrderByCreatedAtDesc(String registryInstitutionId);

    /** Marks every still-open OTP for the institution as superseded. */
    @Modifying
    @Query("""
            update InstitutionVerificationSession s
               set s.status = com.kredent.backend.entity.VerificationSessionStatus.INVALIDATED
             where s.registryInstitutionId = :registryId
               and s.status = com.kredent.backend.entity.VerificationSessionStatus.OTP_SENT
            """)
    int invalidateOpenOtps(@Param("registryId") String registryId);

    /** Wrong guesses across all of an institution's recent OTPs (anti brute-force across resends). */
    @Query("""
            select coalesce(sum(s.attempts), 0) from InstitutionVerificationSession s
             where s.registryInstitutionId = :registryId and s.createdAt >= :since
            """)
    long sumAttemptsSince(@Param("registryId") String registryId, @Param("since") Instant since);

}
