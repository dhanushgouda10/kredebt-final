package com.kredent.backend.repository;

import com.kredent.backend.entity.Certificate;
import com.kredent.backend.entity.CertificateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CertificateRepository extends JpaRepository<Certificate, UUID> {

    Optional<Certificate> findByCertificateNumber(String certificateNumber);

    Optional<Certificate> findByFileHash(String fileHash);

    Optional<Certificate> findByTokenId(Long tokenId);

    List<Certificate> findByStudentId(Long studentId);

    Page<Certificate> findByStudentId(Long studentId, Pageable pageable);

    Page<Certificate> findByStudentIdAndStatusIn(Long studentId, java.util.Collection<CertificateStatus> statuses, Pageable pageable);

    List<Certificate> findByWalletAddress(String walletAddress);

    Optional<Certificate> findByIdAndInstitutionId(UUID id, Long institutionId);

    Page<Certificate> findByStudentIdAndInstitutionId(Long studentId, Long institutionId, Pageable pageable);

    long countByInstitutionIdAndDepartment(Long institutionId, String department);

    long countByInstitutionIdAndDepartmentAndStatus(Long institutionId, String department, CertificateStatus status);

    @Query("""
            SELECT c FROM Certificate c
            WHERE c.institution.id = :institutionId
              AND (:department IS NULL OR c.department = :department)
              AND (:year IS NULL OR c.yearOfCompletion = :year)
              AND (:status IS NULL OR c.status = :status)
              AND (:query = '' OR
                   LOWER(c.certificateNumber) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(c.student.usn) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(c.student.fullName) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<Certificate> searchFiltered(
            @Param("institutionId") Long institutionId,
            @Param("department") String department,
            @Param("year") Integer year,
            @Param("status") CertificateStatus status,
            @Param("query") String query,
            Pageable pageable);

    // Used once, to attach pre-multi-institution rows to an institution (LegacyDataAdopter).
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Certificate c SET c.institution = (SELECT i FROM Institution i WHERE i.id = :institutionId) WHERE c.institution IS NULL")
    int adoptOrphans(@Param("institutionId") Long institutionId);
}
