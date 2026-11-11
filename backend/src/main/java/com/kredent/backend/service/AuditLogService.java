package com.kredent.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kredent.backend.dto.AuditLogResponse;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.util.SecurityConstants;
import com.kredent.backend.entity.ActorType;
import com.kredent.backend.entity.AuditLog;
import com.kredent.backend.entity.Certificate;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.repository.AuditLogRepository;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.StudentRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/**
 * Writes append-only audit entries. Nothing ever updates or deletes a row
 * through this service on purpose — see docs/architecture.md Security Design.
 *
 * Phase 12 adds the read side here too (listAll below) rather than a separate service, since this
 * is already the one place that owns AuditLogRepository and knows the shape of the metadata JSON
 * every call site writes — a second service would either duplicate that knowledge or have to
 * reach back into this one anyway.
 */
@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final HttpServletRequest request;
    private final CertificateRepository certificateRepository;
    private final StudentRepository studentRepository;
    private final AdminRepository adminRepository;
    private final CurrentUserService currentUserService;

    public AuditLogService(
            AuditLogRepository auditLogRepository,
            ObjectMapper objectMapper,
            HttpServletRequest request,
            CertificateRepository certificateRepository,
            StudentRepository studentRepository,
            AdminRepository adminRepository,
            CurrentUserService currentUserService) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
        this.request = request;
        this.certificateRepository = certificateRepository;
        this.studentRepository = studentRepository;
        this.adminRepository = adminRepository;
        this.currentUserService = currentUserService;
    }

    public void record(ActorType actorType, Long actorId, String action, String entityType, String entityId, Map<String, Object> metadata) {
        AuditLog entry = new AuditLog();
        entry.setActorType(actorType);
        entry.setActorId(actorId);
        entry.setAction(action);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setMetadata(toJson(metadata));
        entry.setIpAddress(safeRemoteAddress());

        // Denormalize certificateNumber/studentUsn/department onto the row itself at write time
        // (one lookup here, instead of one lookup per row on every future read) — this is what
        // lets listAll()/searchFiltered() below filter and search at the database level once
        // there are thousands of entries. Never fails the audit write itself if the lookup can't
        // resolve for some reason — an audit record with a missing denormalized field is still a
        // valid, complete audit record; only its searchability by that field is reduced.
        populateDenormalizedFields(entry, entityType, entityId, metadata);
        entry.setInstitutionId(resolveInstitutionId(actorType, actorId, entityType, entityId));

        auditLogRepository.save(entry);
    }

    private void populateDenormalizedFields(AuditLog entry, String entityType, String entityId, Map<String, Object> metadata) {
        try {
            if ("CERTIFICATE".equals(entityType) && entityId != null) {
                certificateRepository.findById(UUID.fromString(entityId)).ifPresent(cert -> {
                    entry.setCertificateNumber(cert.getCertificateNumber());
                    entry.setStudentName(cert.getStudent().getFullName());
                    entry.setStudentUsn(cert.getStudent().getUsn());
                    entry.setDepartment(cert.getDepartment());
                });
            } else if ("STUDENT".equals(entityType) && entityId != null) {
                studentRepository.findById(Long.valueOf(entityId)).ifPresent(student -> {
                    entry.setStudentName(student.getFullName());
                    entry.setStudentUsn(student.getUsn());
                    entry.setDepartment(student.getDepartment());
                });
            }
        } catch (Exception e) {
            // Malformed entityId, or the row was deleted between the action and this audit write
            // (e.g. CERTIFICATE_METADATA_DELETED) — fall back to whatever the caller's own
            // metadata map already captured, same as the read-side fallback in resolveCertificateInfo.
            if (entry.getCertificateNumber() == null) {
                entry.setCertificateNumber(stringValue(metadata, "certificateNumber"));
            }
            if (entry.getDepartment() == null) {
                entry.setDepartment(stringValue(metadata, "department"));
            }
        }
    }

    /**
     * Backs the admin Audit Logs page (GET /api/admin/audit-logs). Read-only — nothing here ever
     * writes. @Transactional(readOnly = true) because the legacy-row fallback below (rows written
     * before certificate_number/student_usn/department existed) still touches
     * Certificate.student, a lazy association; that needs an open Hibernate session for the whole
     * page mapping, not just the initial query.
     */
    /**
     * The institution an audit entry belongs to. Administrator actions carry it on the request (set
     * from the verified JWT); student actions and system writes fall back to the institution of the
     * student / certificate the entry is about. Null only when nothing can be resolved.
     */
    private Long resolveInstitutionId(ActorType actorType, Long actorId, String entityType, String entityId) {
        try {
            Object attr = request.getAttribute(SecurityConstants.INSTITUTION_ID_ATTRIBUTE);
            if (attr instanceof Long id) {
                return id;
            }
        } catch (IllegalStateException ignored) {
            // no current request (e.g. a scheduled job) — fall through to entity-based lookup
        }
        try {
            if (actorType == ActorType.STUDENT && actorId != null) {
                Long id = studentRepository.findById(actorId)
                        .map(s -> s.getInstitution() == null ? null : s.getInstitution().getId()).orElse(null);
                if (id != null) {
                    return id;
                }
            }
            if ("INSTITUTION".equals(entityType) && entityId != null) {
                return Long.valueOf(entityId);
            }
            if ("CERTIFICATE".equals(entityType) && entityId != null) {
                return certificateRepository.findById(UUID.fromString(entityId))
                        .map(c -> c.getInstitution() == null ? null : c.getInstitution().getId()).orElse(null);
            }
            if ("STUDENT".equals(entityType) && entityId != null) {
                return studentRepository.findById(Long.valueOf(entityId))
                        .map(s -> s.getInstitution() == null ? null : s.getInstitution().getId()).orElse(null);
            }
        } catch (RuntimeException ignored) {
            // an unresolvable entity must never fail the audit write itself
        }
        return null;
    }

    /** The signed-in administrator's own institution's audit trail — never another institution's. */
    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> listFiltered(String action, String department, String search, Pageable pageable) {
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        String query = search == null ? "" : search.trim();
        Page<AuditLog> page = auditLogRepository.searchFiltered(
                institutionId,
                (action == null || action.isBlank()) ? null : action,
                (department == null || department.isBlank()) ? null : department,
                query,
                pageable);
        return PageResponse.from(page, this::toResponse);
    }

    private AuditLogResponse toResponse(AuditLog entry) {
        AuditLogResponse dto = new AuditLogResponse();
        dto.setId(entry.getId());
        dto.setCreatedAt(entry.getCreatedAt());
        dto.setAction(entry.getAction());
        dto.setActorType(entry.getActorType() != null ? entry.getActorType().name() : null);
        dto.setEntityType(entry.getEntityType());
        dto.setEntityId(entry.getEntityId());
        dto.setDepartment(entry.getDepartment());

        Map<String, Object> metadata = parseMetadata(entry.getMetadata());
        dto.setDetails(metadata);
        dto.setTransactionHash(stringValue(metadata, "transactionHash"));
        dto.setActorName(resolveActorName(entry.getActorType(), entry.getActorId()));

        // Fast path: rows written after this denormalization was added already carry everything
        // needed directly on the row — no extra query. Only rows written before it (where these
        // columns are null) fall back to the original live lookup, so old audit history still
        // displays correctly, just without the scalability benefit for those specific rows.
        if (entry.getCertificateNumber() != null || entry.getStudentUsn() != null || entry.getStudentName() != null) {
            dto.setCertificateNumber(entry.getCertificateNumber());
            dto.setStudentName(entry.getStudentName());
            dto.setStudentUsn(entry.getStudentUsn());
        } else if ("CERTIFICATE".equals(entry.getEntityType())) {
            resolveCertificateInfo(entry.getEntityId(), metadata, dto);
        } else if ("STUDENT".equals(entry.getEntityType())) {
            resolveStudentInfo(entry.getEntityId(), metadata, dto);
        }

        return dto;
    }

    private String resolveActorName(ActorType actorType, Long actorId) {
        if (actorType == null) {
            return null;
        }
        if (actorType == ActorType.ADMIN) {
            if (actorId == null) {
                return "Admin";
            }
            return adminRepository.findById(actorId).map(a -> a.getFullName()).orElse("Admin #" + actorId);
        }
        if (actorType == ActorType.STUDENT) {
            if (actorId == null) {
                return "Student";
            }
            return studentRepository.findById(actorId).map(s -> s.getFullName()).orElse("Student #" + actorId);
        }
        if (actorType == ActorType.PUBLIC) {
            return "Public / anonymous";
        }
        return "System";
    }

    /**
     * Prefers a live lookup of the certificate (covers actions whose stored metadata never
     * included certificateNumber — CERTIFICATE_FILE_UPLOADED, CERTIFICATE_STATUS_UPDATED,
     * CERTIFICATE_BLOCKCHAIN_ISSUED/REVOKED all only stored the UUID as entityId). Falls back to
     * whatever the metadata captured at write time if the certificate can't be found — the only
     * source left once a certificate row has actually been deleted (CERTIFICATE_METADATA_DELETED,
     * which does store certificateNumber/studentId in its metadata for exactly this reason).
     */
    private void resolveCertificateInfo(String entityId, Map<String, Object> metadata, AuditLogResponse dto) {
        Certificate certificate = null;
        if (entityId != null) {
            try {
                certificate = certificateRepository.findById(UUID.fromString(entityId)).orElse(null);
            } catch (IllegalArgumentException ignored) {
                // entityId wasn't a valid UUID — fall through to metadata-only below.
            }
        }

        if (certificate != null) {
            dto.setCertificateNumber(certificate.getCertificateNumber());
            dto.setStudentName(certificate.getStudent().getFullName());
            dto.setStudentUsn(certificate.getStudent().getUsn());
            return;
        }

        dto.setCertificateNumber(stringValue(metadata, "certificateNumber"));
        Long studentId = longValue(metadata, "studentId");
        if (studentId != null) {
            studentRepository.findById(studentId).ifPresent(s -> {
                dto.setStudentName(s.getFullName());
                dto.setStudentUsn(s.getUsn());
            });
        }
    }

    private void resolveStudentInfo(String entityId, Map<String, Object> metadata, AuditLogResponse dto) {
        Long studentId = entityId != null ? parseLong(entityId) : null;
        if (studentId != null) {
            var found = studentRepository.findById(studentId);
            if (found.isPresent()) {
                dto.setStudentName(found.get().getFullName());
                dto.setStudentUsn(found.get().getUsn());
                return;
            }
        }
        // Student was deleted, or entityId wasn't parseable — fall back to what was captured
        // at write time (STUDENT_CREATED/STUDENT_UPDATED both store "usn" in metadata).
        dto.setStudentUsn(stringValue(metadata, "usn"));
    }

    private Map<String, Object> parseMetadata(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse audit log metadata JSON, returning empty details", e);
            return Map.of();
        }
    }

    private String stringValue(Map<String, Object> metadata, String key) {
        if (metadata == null) {
            return null;
        }
        Object value = metadata.get(key);
        return value != null ? String.valueOf(value) : null;
    }

    private Long longValue(Map<String, Object> metadata, String key) {
        if (metadata == null) {
            return null;
        }
        Object value = metadata.get(key);
        return value != null ? parseLong(String.valueOf(value)) : null;
    }

    private Long parseLong(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String toJson(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit log metadata, storing without it", e);
            return null;
        }
    }

    private String safeRemoteAddress() {
        try {
            return request.getRemoteAddr();
        } catch (Exception e) {
            return null;
        }
    }
}
