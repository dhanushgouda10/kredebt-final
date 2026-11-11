package com.kredent.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * Append-only audit trail. No update/delete is ever exposed for this entity
 * at the API layer (by design — see docs/architecture.md Security Design).
 *
 * actorId/entityId are deliberately loose (nullable Long / String) rather
 * than real foreign keys: the actor may be an anonymous public verifier
 * (no id at all), and entityId's underlying type differs by entity
 * (Certificate uses UUID, Student/Admin use Long), so a single typed FK
 * column can't represent all of them. metadata is stored as plain text for
 * now (a JSON string written by the caller) rather than a real jsonb column,
 * to avoid pulling in an extra Hibernate type-mapping dependency before
 * anything actually needs structured queries over it.
 */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "actor_type", nullable = false)
    private ActorType actorType;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(nullable = false)
    private String action;

    @Column(name = "entity_type")
    private String entityType;

    @Column(name = "entity_id")
    private String entityId;

    // Denormalized at write time (see AuditLogService.record) purely so the admin Audit Logs
    // page can filter/search at the database level once there are thousands of rows, instead of
    // fetching a capped page and filtering client-side, or re-resolving every certificate/student
    // per row on every read. Nullable — rows written before these columns existed simply have no
    // value here; AuditLogService.toResponse() falls back to its original live-lookup for those.
    @Column(name = "certificate_number")
    private String certificateNumber;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "student_usn")
    private String studentUsn;

    @Column(name = "department")
    private String department;

    // Owning institution, so each institution can only read its own audit trail.
    @Column(name = "institution_id")
    private Long institutionId;

    @Column(columnDefinition = "text")
    private String metadata;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ActorType getActorType() {
        return actorType;
    }

    public void setActorType(ActorType actorType) {
        this.actorType = actorType;
    }

    public Long getActorId() {
        return actorId;
    }

    public void setActorId(Long actorId) {
        this.actorId = actorId;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getCertificateNumber() {
        return certificateNumber;
    }

    public void setCertificateNumber(String certificateNumber) {
        this.certificateNumber = certificateNumber;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getStudentUsn() {
        return studentUsn;
    }

    public void setStudentUsn(String studentUsn) {
        this.studentUsn = studentUsn;
    }

    public Long getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(Long institutionId) {
        this.institutionId = institutionId;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
