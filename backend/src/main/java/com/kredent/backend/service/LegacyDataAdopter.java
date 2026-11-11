package com.kredent.backend.service;

import com.kredent.backend.entity.Institution;
import com.kredent.backend.repository.AuditLogRepository;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.repository.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One-off bridge for data written before Kredent became multi-institution. Students, certificates and
 * audit rows from that time have no institution and would therefore be invisible to every institution.
 *
 * If {@code institution.adopt-legacy-data-for} (env INSTITUTION_ADOPT_LEGACY_DATA_FOR) names a registry
 * institutional ID, every row that still has no institution is attached to that institution as soon as
 * it has completed Kredent verification. It only ever touches rows whose institution is NULL, so it is
 * safe to leave configured; remove the setting once the migration has run.
 */
@Service
public class LegacyDataAdopter {

    private static final Logger log = LoggerFactory.getLogger(LegacyDataAdopter.class);

    private final String targetRegistryId;
    private final InstitutionRepository institutionRepository;
    private final StudentRepository studentRepository;
    private final CertificateRepository certificateRepository;
    private final AuditLogRepository auditLogRepository;

    public LegacyDataAdopter(
            @Value("${institution.adopt-legacy-data-for:}") String targetRegistryId,
            InstitutionRepository institutionRepository,
            StudentRepository studentRepository,
            CertificateRepository certificateRepository,
            AuditLogRepository auditLogRepository) {
        this.targetRegistryId = targetRegistryId == null ? "" : targetRegistryId.trim();
        this.institutionRepository = institutionRepository;
        this.studentRepository = studentRepository;
        this.certificateRepository = certificateRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!targetRegistryId.isEmpty()) {
            institutionRepository.findByRegistryInstitutionId(targetRegistryId).ifPresent(this::adoptFor);
        }
    }

    @Transactional
    public void adoptFor(Institution institution) {
        if (targetRegistryId.isEmpty() || !institution.isOnboarded()
                || !targetRegistryId.equalsIgnoreCase(institution.getRegistryInstitutionId())) {
            return;
        }
        int students = studentRepository.adoptOrphans(institution.getId());
        int certificates = certificateRepository.adoptOrphans(institution.getId());
        int audits = auditLogRepository.adoptOrphans(institution.getId());
        if (students + certificates + audits > 0) {
            log.info("Attached pre-existing data to institution {}: {} students, {} certificates, {} audit rows",
                    institution.getRegistryInstitutionId(), students, certificates, audits);
        }
    }
}
