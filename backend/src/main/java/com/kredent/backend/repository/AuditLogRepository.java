package com.kredent.backend.repository;

import com.kredent.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // action/department/search are each optional (null/blank means "any"), combined and
    // evaluated in SQL so the admin Audit Logs page can filter/search at scale instead of
    // fetching a capped page and filtering in the browser. Matches against the denormalized
    // certificate_number/student_usn columns (see AuditLog's class comment) plus action and the
    // free-form entityId (covers STUDENT rows, whose entityId is the student's own id/USN-adjacent
    // key) — not full-text over metadata, which stays a display-only field.
    @Query("""
            SELECT a FROM AuditLog a
            WHERE a.institutionId = :institutionId
              AND (:action IS NULL OR a.action = :action)
              AND (:department IS NULL OR a.department = :department)
              AND (:query = '' OR
                   LOWER(a.action) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(COALESCE(a.certificateNumber, '')) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(COALESCE(a.studentUsn, '')) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<AuditLog> searchFiltered(
            @Param("institutionId") Long institutionId,
            @Param("action") String action,
            @Param("department") String department,
            @Param("query") String query,
            Pageable pageable);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE AuditLog a SET a.institutionId = :institutionId WHERE a.institutionId IS NULL")
    int adoptOrphans(@Param("institutionId") Long institutionId);
}
