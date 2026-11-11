package com.kredent.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A single issued credential. Storage (storagePath/fileUrl) and hashing
 * (fileHash) are populated by the certificate upload flow (Phase 2).
 * Blockchain fields (walletAddress, tokenId, contractAddress, txHash,
 * mintedAt) are populated by CertificateService.issueOnBlockchain (Phase 3)
 * once the admin's MetaMask has signed and mined the on-chain mint
 * transaction — see also BlockchainVerificationService, which verifies that
 * transaction before any of these fields are trusted/saved.
 */
@Entity
@Table(name = "certificates")
public class Certificate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "certificate_number", nullable = false, unique = true)
    private String certificateNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issued_by_admin_id", nullable = false)
    private Admin issuedByAdmin;

    /**
     * The institution that issued this certificate (shown on public verification). Nullable only
     * because certificates created before multi-institution support have none.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id")
    private Institution institution;

    @Column(name = "degree_name", nullable = false)
    private String degreeName;

    @Column(nullable = false)
    private String department;

    @Column(name = "year_of_completion", nullable = false)
    private Integer yearOfCompletion;

    // Supabase Storage object key — the PDF itself never touches this table or the blockchain.
    // Nullable until a file is actually uploaded (Backend Module 3).
    @Column(name = "storage_path")
    private String storagePath;

    // Informational/audit reference to the Supabase object endpoint — NOT a browsable public
    // URL (the bucket is private). Actual downloads always go through our own authorized
    // /download endpoint, which fetches the bytes server-side using the service role key.
    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "original_filename")
    private String originalFilename;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    // SHA-256 (hex) of the uploaded PDF's raw bytes, computed server-side in
    // CertificateService.uploadFile. Null until a file is uploaded.
    @Column(name = "file_hash", unique = true)
    private String fileHash;

    // Frozen at issuance time — intentionally independent of students.wallet_address, which is
    // read fresh each time (see CertificateResponse.studentWalletAddress) but could in theory
    // change later. This column captures exactly which address the on-chain credential was
    // actually minted to, permanently. Null until CertificateService.issueOnBlockchain runs.
    @Column(name = "wallet_address")
    private String walletAddress;

    @Column(name = "token_id", unique = true)
    private Long tokenId;

    @Column(name = "contract_address")
    private String contractAddress;

    @Column(name = "tx_hash", unique = true)
    private String txHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CertificateStatus status = CertificateStatus.PENDING_MINT;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private LocalDateTime issuedAt;

    @Column(name = "minted_at")
    private LocalDateTime mintedAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoked_reason")
    private String revokedReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        issuedAt = now;
        createdAt = now;
        updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCertificateNumber() {
        return certificateNumber;
    }

    public void setCertificateNumber(String certificateNumber) {
        this.certificateNumber = certificateNumber;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public Admin getIssuedByAdmin() {
        return issuedByAdmin;
    }

    public void setIssuedByAdmin(Admin issuedByAdmin) {
        this.issuedByAdmin = issuedByAdmin;
    }

    public Institution getInstitution() {
        return institution;
    }

    public void setInstitution(Institution institution) {
        this.institution = institution;
    }

    public String getDegreeName() {
        return degreeName;
    }

    public void setDegreeName(String degreeName) {
        this.degreeName = degreeName;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public Integer getYearOfCompletion() {
        return yearOfCompletion;
    }

    public void setYearOfCompletion(Integer yearOfCompletion) {
        this.yearOfCompletion = yearOfCompletion;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public void setStoragePath(String storagePath) {
        this.storagePath = storagePath;
    }

    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public void setOriginalFilename(String originalFilename) {
        this.originalFilename = originalFilename;
    }

    public Long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(Long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    public Long getTokenId() {
        return tokenId;
    }

    public void setTokenId(Long tokenId) {
        this.tokenId = tokenId;
    }

    public String getContractAddress() {
        return contractAddress;
    }

    public void setContractAddress(String contractAddress) {
        this.contractAddress = contractAddress;
    }

    public String getTxHash() {
        return txHash;
    }

    public void setTxHash(String txHash) {
        this.txHash = txHash;
    }

    public CertificateStatus getStatus() {
        return status;
    }

    public void setStatus(CertificateStatus status) {
        this.status = status;
    }

    public LocalDateTime getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(LocalDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    public LocalDateTime getMintedAt() {
        return mintedAt;
    }

    public void setMintedAt(LocalDateTime mintedAt) {
        this.mintedAt = mintedAt;
    }

    public LocalDateTime getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(LocalDateTime revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
