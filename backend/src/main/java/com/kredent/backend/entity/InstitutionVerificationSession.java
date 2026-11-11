package com.kredent.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One verification attempt: an OTP bound to an institutional ID and to this session's random ID.
 *
 * Only a salted HMAC of the OTP is stored (see OtpUtil), never the code. The session ID is a
 * random UUID that the browser holds; it is the handle for "verify the OTP" and "complete the
 * wallet step" and is useless without also knowing the emailed code.
 */
@Entity
@Table(name = "institution_verification_sessions", indexes = {
        @Index(name = "idx_ivs_registry_id_created", columnList = "registry_institution_id, created_at")
})
public class InstitutionVerificationSession {

    @Id
    private UUID id;

    @Column(name = "registry_institution_id", nullable = false, length = 40)
    private String registryInstitutionId;

    @Column(name = "otp_hash", nullable = false, length = 128)
    private String otpHash;

    @Column(name = "otp_salt", nullable = false, length = 64)
    private String otpSalt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    private int attempts;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VerificationSessionStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getRegistryInstitutionId() {
        return registryInstitutionId;
    }

    public void setRegistryInstitutionId(String registryInstitutionId) {
        this.registryInstitutionId = registryInstitutionId;
    }

    public String getOtpHash() {
        return otpHash;
    }

    public void setOtpHash(String otpHash) {
        this.otpHash = otpHash;
    }

    public String getOtpSalt() {
        return otpSalt;
    }

    public void setOtpSalt(String otpSalt) {
        this.otpSalt = otpSalt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public int getAttempts() {
        return attempts;
    }

    public void setAttempts(int attempts) {
        this.attempts = attempts;
    }

    public VerificationSessionStatus getStatus() {
        return status;
    }

    public void setStatus(VerificationSessionStatus status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }
}
