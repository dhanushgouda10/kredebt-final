package com.kredent.backend.repository;

import com.kredent.backend.entity.Student;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StudentRepository extends JpaRepository<Student, Long> {

    // Email is the sign-in identity, so it stays unique across the whole platform.
    boolean existsByEmail(String email);

    Optional<Student> findByEmail(String email);

    // A USN is only unique within one institution.
    boolean existsByInstitutionIdAndUsn(Long institutionId, String usn);

    Optional<Student> findByIdAndInstitutionId(Long id, Long institutionId);

    Optional<Student> findByInstitutionIdAndUsn(Long institutionId, String usn);

    long countByInstitutionIdAndDepartment(Long institutionId, String department);

    @Query("""
            SELECT s FROM Student s
            WHERE s.institution.id = :institutionId
              AND (:query = '' OR
                   LOWER(s.usn) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(s.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(s.email) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<Student> search(@Param("institutionId") Long institutionId, @Param("query") String query, Pageable pageable);

    @Query("""
            SELECT s FROM Student s
            WHERE s.institution.id = :institutionId
              AND s.department = :department
              AND (:query = '' OR
                   LOWER(s.usn) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(s.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
                OR LOWER(s.email) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<Student> searchByDepartment(
            @Param("institutionId") Long institutionId,
            @Param("department") String department,
            @Param("query") String query,
            Pageable pageable);

    @Query("SELECT s.department, COUNT(s) FROM Student s WHERE s.institution.id = :institutionId GROUP BY s.department")
    List<Object[]> countGroupedByDepartment(@Param("institutionId") Long institutionId);

    // Used once, to attach pre-multi-institution rows to an institution (LegacyDataAdopter).
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Student s SET s.institution = (SELECT i FROM Institution i WHERE i.id = :institutionId) WHERE s.institution IS NULL")
    int adoptOrphans(@Param("institutionId") Long institutionId);
}
