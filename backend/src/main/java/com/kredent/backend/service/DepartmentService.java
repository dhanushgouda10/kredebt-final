package com.kredent.backend.service;

import com.kredent.backend.dto.DepartmentResponse;
import com.kredent.backend.dto.DepartmentSummaryResponse;
import com.kredent.backend.entity.CertificateStatus;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.StudentRepository;
import com.kredent.backend.util.DepartmentCatalog;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Composes StudentRepository + CertificateRepository counts into the department-oriented
 * overview the admin portal needs (Students page department chips, Certificate Registry's
 * per-department dashboard strip). Every number is a live COUNT query — nothing here is
 * estimated, cached, or hardcoded, per the explicit "use real database values only" requirement.
 */
@Service
@Transactional(readOnly = true)
public class DepartmentService {

    private final StudentRepository studentRepository;
    private final CertificateRepository certificateRepository;
    private final CurrentUserService currentUserService;

    public DepartmentService(
            StudentRepository studentRepository,
            CertificateRepository certificateRepository,
            CurrentUserService currentUserService) {
        this.studentRepository = studentRepository;
        this.certificateRepository = certificateRepository;
        this.currentUserService = currentUserService;
    }

    /** The full department catalog, each with its real current student count. */
    public List<DepartmentResponse> listDepartments() {
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : studentRepository.countGroupedByDepartment(institutionId)) {
            String department = (String) row[0];
            Long count = (Long) row[1];
            if (department != null) {
                counts.put(department, count);
            }
        }

        return DepartmentCatalog.all().stream()
                .map(d -> new DepartmentResponse(d.code(), d.label(), counts.getOrDefault(d.code(), 0L)))
                .toList();
    }

    /** Real counts for one department — 404s for a code outside the known catalog rather than silently returning zeros. */
    public DepartmentSummaryResponse getSummary(String code) {
        if (!DepartmentCatalog.isValidCode(code)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown department code: " + code);
        }

        Long institutionId = currentUserService.getCurrentInstitution().getId();
        DepartmentSummaryResponse dto = new DepartmentSummaryResponse();
        dto.setCode(code);
        dto.setLabel(DepartmentCatalog.labelFor(code));
        dto.setTotalStudents(studentRepository.countByInstitutionIdAndDepartment(institutionId, code));
        dto.setTotalCertificates(certificateRepository.countByInstitutionIdAndDepartment(institutionId, code));
        dto.setPendingMint(certificateRepository.countByInstitutionIdAndDepartmentAndStatus(institutionId, code, CertificateStatus.PENDING_MINT));
        dto.setMinted(certificateRepository.countByInstitutionIdAndDepartmentAndStatus(institutionId, code, CertificateStatus.MINTED));
        dto.setMintFailed(certificateRepository.countByInstitutionIdAndDepartmentAndStatus(institutionId, code, CertificateStatus.MINT_FAILED));
        dto.setRevoked(certificateRepository.countByInstitutionIdAndDepartmentAndStatus(institutionId, code, CertificateStatus.REVOKED));
        return dto;
    }
}
