package com.kredent.backend.service;

import com.kredent.backend.dto.CertificateMetadataRequest;
import com.kredent.backend.dto.CertificateResponse;
import com.kredent.backend.dto.IssueBlockchainRequest;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.dto.RevokeBlockchainRequest;
import com.kredent.backend.dto.UpdateCertificateStatusRequest;
import com.kredent.backend.entity.ActorType;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Certificate;
import com.kredent.backend.entity.CertificateStatus;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.StudentRepository;
import com.kredent.backend.util.FileValidationUtil;
import com.kredent.backend.util.HashUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Class-level @Transactional matters here specifically because Certificate's
 * student/issuedByAdmin associations are lazy (see entity comments): mapping
 * to CertificateResponse touches non-id fields on those proxies (fullName,
 * usn), which requires an open Hibernate session for the whole method, not
 * just for the repository call. This is a service-layer/JPA concern, not a
 * change to authentication.
 */
@Service
@Transactional
public class CertificateService {

    private final CertificateRepository certificateRepository;
    private final StudentRepository studentRepository;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final SupabaseStorageService storageService;
    private final BlockchainVerificationService blockchainVerificationService;
    private final PdfStampingService pdfStampingService;
    private final CertificateRenderer certificateRenderer;
    private final long maxFileSizeBytes;
    private final String frontendBaseUrl;

    public CertificateService(
            CertificateRepository certificateRepository,
            StudentRepository studentRepository,
            CurrentUserService currentUserService,
            AuditLogService auditLogService,
            SupabaseStorageService storageService,
            BlockchainVerificationService blockchainVerificationService,
            PdfStampingService pdfStampingService,
            CertificateRenderer certificateRenderer,
            @Value("${app.certificate.max-file-size-mb:5}") long maxFileSizeMb,
            @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.certificateRepository = certificateRepository;
        this.studentRepository = studentRepository;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.storageService = storageService;
        this.blockchainVerificationService = blockchainVerificationService;
        this.pdfStampingService = pdfStampingService;
        this.certificateRenderer = certificateRenderer;
        this.maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public CertificateResponse createMetadata(CertificateMetadataRequest request) {
        Institution institution = currentUserService.getCurrentInstitution();
        Student student = studentRepository.findByIdAndInstitutionId(request.getStudentId(), institution.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        Admin admin = currentUserService.getCurrentAdmin();

        Certificate certificate = new Certificate();
        certificate.setCertificateNumber(generateCertificateNumber(request.getYearOfCompletion()));
        certificate.setStudent(student);
        certificate.setIssuedByAdmin(admin);
        certificate.setInstitution(institution);
        certificate.setDegreeName(request.getDegreeName());
        // Always the student's own department — never independently chosen — so a certificate
        // can never disagree with the student record it belongs to (see CertificateMetadataRequest).
        certificate.setDepartment(student.getDepartment());
        certificate.setYearOfCompletion(request.getYearOfCompletion());
        certificate.setStatus(CertificateStatus.PENDING_MINT);
        certificateRepository.save(certificate);

        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_METADATA_ISSUED",
                "CERTIFICATE",
                certificate.getId().toString(),
                Map.of("certificateNumber", certificate.getCertificateNumber(), "studentId", student.getId())
        );

        return CertificateResponse.from(certificate);
    }

    public CertificateResponse getById(UUID id) {
        Certificate certificate = findOrThrow(id);
        assertCanView(certificate);
        return CertificateResponse.from(certificate);
    }

    public PageResponse<CertificateResponse> getOwnCertificates(Pageable pageable) {
        Student student = currentUserService.getCurrentStudent();
        // Students only see certificates that have been issued on the blockchain (or later revoked) —
        // never drafts the institution is still preparing.
        Page<Certificate> page = certificateRepository.findByStudentIdAndStatusIn(
                student.getId(), STUDENT_VISIBLE, pageable);
        return PageResponse.from(page, CertificateResponse::from);
    }

    private static final java.util.Set<CertificateStatus> STUDENT_VISIBLE =
            java.util.Set.of(CertificateStatus.MINTED, CertificateStatus.REVOKED);

    /** Admin registry view — all certificates, optionally filtered by a search term (student name/USN/certificate number). */
    /** The signed-in institution's certificates, optionally filtered. Never includes another institution's. */
    public PageResponse<CertificateResponse> listAll(String search, Pageable pageable) {
        return listFiltered(null, null, null, search, pageable);
    }

    public PageResponse<CertificateResponse> listFiltered(
            String department, Integer year, CertificateStatus status, String search, Pageable pageable) {
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        String query = search == null ? "" : search.trim();
        Page<Certificate> page = certificateRepository.searchFiltered(
                institutionId,
                (department == null || department.isBlank()) ? null : department,
                year, status, query, pageable);
        return PageResponse.from(page, CertificateResponse::from);
    }

    public PageResponse<CertificateResponse> getCertificatesForStudent(Long studentId, Pageable pageable) {
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        if (studentRepository.findByIdAndInstitutionId(studentId, institutionId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found");
        }
        Page<Certificate> page = certificateRepository.findByStudentIdAndInstitutionId(studentId, institutionId, pageable);
        return PageResponse.from(page, CertificateResponse::from);
    }

    public CertificateResponse uploadFile(UUID id, MultipartFile file) {
        Certificate certificate = findOwnOrThrow(id);
        if (certificate.getStatus() == CertificateStatus.MINTED || certificate.getStatus() == CertificateStatus.REVOKED
                || certificate.getTokenId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This certificate is already recorded on-chain; replacing its PDF would no longer match the on-chain hash");
        }
        validateFile(file);

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read the uploaded file");
        }

        if (!FileValidationUtil.looksLikePdf(content)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The file does not look like a valid PDF (failed signature check)");
        }

        // Phase 11: stamp a QR code (linking to the public verify page for this certificate)
        // onto the PDF BEFORE anything below touches it. Everything that follows — hashing,
        // dedupe check, storage — operates on the STAMPED bytes, not the raw upload. That
        // ordering is what makes the QR forgery-resistant: it becomes part of the exact file
        // whose hash gets stored and later minted on-chain, so a copy of the QR pasted into a
        // different PDF produces bytes that no longer hash-match (caught by
        // PublicVerificationService.verifyPdf).
        String verificationUrl = frontendBaseUrl + "/verify/" + certificate.getCertificateNumber();
        byte[] stampedContent;
        try {
            stampedContent = pdfStampingService.stampQrCode(content, verificationUrl);
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not generate the verification QR code for this certificate", e);
        }

        return storeFinalPdf(certificate, stampedContent, file.getOriginalFilename());
    }

    /**
     * Generates the standard Kredent certificate from the student's record (no file upload).
     * The PDF is drawn server-side with the verification QR already on it, hashed, and stored
     * exactly like an uploaded one, so the rest of the issuing flow (on-chain mint, verify page,
     * PDF check) is unchanged.
     */
    /** A watermarked sample of the standard certificate for the admin's own college (nothing is saved). */
    public byte[] previewSample() {
        Institution institution = currentUserService.getCurrentInstitution();
        CertificateRenderer.Content content = new CertificateRenderer.Content(
                institution.getName(), "Student Name", "USN0000", "Bachelor of Engineering",
                "Department Name", (java.time.Year.now().getValue() - 1) + " - " + java.time.Year.now().getValue(),
                java.time.LocalDate.now(), "SAMPLE-0000", frontendBaseUrl + "/verify/SAMPLE-0000");
        return certificateRenderer.render(content, true);
    }

    public CertificateResponse generateFile(UUID id) {
        Certificate certificate = findOwnOrThrow(id);
        if (certificate.getStatus() == CertificateStatus.MINTED || certificate.getStatus() == CertificateStatus.REVOKED
                || certificate.getTokenId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This certificate is already recorded on-chain; regenerating its PDF would no longer match the on-chain hash");
        }
        CertificateRenderer.Content content = contentFor(certificate);
        byte[] pdf;
        try {
            pdf = certificateRenderer.render(content);
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Could not generate the certificate PDF", e);
        }
        return storeFinalPdf(certificate, pdf, certificate.getCertificateNumber() + ".pdf");
    }

    private CertificateRenderer.Content contentFor(Certificate certificate) {
        Student student = certificate.getStudent();
        Institution institution = certificate.getInstitution();
        int year = certificate.getYearOfCompletion();
        return new CertificateRenderer.Content(
                institution != null ? institution.getName() : "",
                student.getFullName(),
                student.getUsn(),
                certificate.getDegreeName(),
                com.kredent.backend.util.DepartmentCatalog.labelFor(certificate.getDepartment()),
                (year - 1) + " - " + year,
                certificate.getIssuedAt().toLocalDate(),
                certificate.getCertificateNumber(),
                frontendBaseUrl + "/verify/" + certificate.getCertificateNumber());
    }

    /**
     * Re-creates a generated certificate's PDF in storage if the stored file was lost. The PDF is
     * re-rendered from the record and only written back when its SHA-256 matches the hash already
     * recorded (and minted on-chain) — so a restored file is always exactly the original. If the
     * hash does not match (for example the file was an uploaded PDF, or was generated before
     * reproducible rendering), nothing is written and the admin is told why.
     */
    public CertificateResponse restoreFile(UUID id) {
        Certificate certificate = findOwnOrThrow(id);
        if (certificate.getFileHash() == null || certificate.getStoragePath() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This certificate has no stored file to restore");
        }
        byte[] pdf;
        try {
            pdf = certificateRenderer.render(contentFor(certificate));
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not re-create the certificate PDF", e);
        }
        if (!HashUtil.sha256Hex(pdf).equalsIgnoreCase(certificate.getFileHash())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The original file cannot be re-created exactly (it was uploaded manually or created by an older "
                            + "version), so it would not match the hash recorded on the blockchain. Revoke this certificate "
                            + "and issue a new one.");
        }
        storageService.upload(certificate.getStoragePath(), pdf, FileValidationUtil.PDF_CONTENT_TYPE);
        auditLogService.record(ActorType.ADMIN, currentUserService.getCurrentAdmin().getId(),
                "CERTIFICATE_FILE_RESTORED", "CERTIFICATE", id.toString(),
                Map.of("fileHash", certificate.getFileHash()));
        return CertificateResponse.from(certificate);
    }

    private CertificateResponse storeFinalPdf(Certificate certificate, byte[] stampedContent, String originalFilename) {
        UUID id = certificate.getId();
        // The hash is computed from the exact stamped bytes that will actually be stored and
        // served — this is the PDF's real fingerprint, independent of where it's stored.
        String fileHash = HashUtil.sha256Hex(stampedContent);

        certificateRepository.findByFileHash(fileHash).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This exact PDF has already been uploaded for another certificate (" + existing.getCertificateNumber() + ")");
            }
        });

        String sanitizedUsn = certificate.getStudent().getUsn().replaceAll("[^A-Za-z0-9]", "");
        String objectPath = "certificates/" + sanitizedUsn + "/" + UUID.randomUUID() + ".pdf";

        String fileUrl = storageService.upload(objectPath, stampedContent, FileValidationUtil.PDF_CONTENT_TYPE);

        certificate.setStoragePath(objectPath);
        certificate.setFileUrl(fileUrl);
        certificate.setOriginalFilename(originalFilename);
        certificate.setFileSizeBytes((long) stampedContent.length);
        certificate.setMimeType(FileValidationUtil.PDF_CONTENT_TYPE);
        certificate.setFileHash(fileHash);
        certificate.setUploadedAt(LocalDateTime.now());
        certificateRepository.save(certificate);

        Admin admin = currentUserService.getCurrentAdmin();
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_FILE_UPLOADED",
                "CERTIFICATE",
                id.toString(),
                Map.of(
                        "originalFilename", String.valueOf(originalFilename),
                        "fileSizeBytes", stampedContent.length,
                        "fileHash", fileHash
                )
        );

        return CertificateResponse.from(certificate);
    }

    public CertificateFile downloadFile(UUID id) {
        Certificate certificate = findOrThrow(id);
        assertCanView(certificate);

        if (certificate.getStoragePath() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No file has been uploaded for this certificate yet");
        }

        byte[] content = storageService.download(certificate.getStoragePath());
        String filename = certificate.getOriginalFilename() != null
                ? certificate.getOriginalFilename()
                : certificate.getCertificateNumber() + ".pdf";
        String mimeType = certificate.getMimeType() != null ? certificate.getMimeType() : FileValidationUtil.PDF_CONTENT_TYPE;

        return new CertificateFile(content, filename, mimeType);
    }

    public void deleteMetadata(UUID id) {
        Certificate certificate = findOwnOrThrow(id);
        if (certificate.getTokenId() != null || certificate.getStatus() == CertificateStatus.MINTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This certificate has an on-chain record and cannot be deleted. Revoke it on-chain instead.");
        }
        Admin admin = currentUserService.getCurrentAdmin();

        boolean hadFile = certificate.getStoragePath() != null;
        Map<String, Object> metadata = Map.of(
                "certificateNumber", certificate.getCertificateNumber(),
                "studentId", certificate.getStudent().getId(),
                "fileDeleted", hadFile
        );

        if (hadFile) {
            storageService.delete(certificate.getStoragePath());
        }
        certificateRepository.delete(certificate);

        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_METADATA_DELETED",
                "CERTIFICATE",
                id.toString(),
                metadata
        );
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file was uploaded, or the file is empty");
        }
        if (!FileValidationUtil.isDeclaredPdf(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are accepted");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "File exceeds the maximum allowed size of " + (maxFileSizeBytes / (1024 * 1024)) + "MB");
        }
    }

    public CertificateResponse updateStatus(UUID id, UpdateCertificateStatusRequest request) {
        Certificate certificate = findOwnOrThrow(id);

        if (request.getStatus() == CertificateStatus.REVOKED && (request.getReason() == null || request.getReason().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason is required to revoke a certificate");
        }
        // Once a certificate is minted on-chain, its status must stay in sync with the smart
        // contract — this plain endpoint can't do that, so it defers to revokeOnBlockchain()
        // below, which actually revokes on-chain first. Certificates that never got minted
        // (still PENDING_MINT / MINT_FAILED) keep working through this endpoint exactly as
        // they did in Phase 2 — nothing changes for that case.
        if (request.getStatus() == CertificateStatus.MINTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A certificate can only become MINTED by issuing it on the blockchain");
        }
        if (certificate.getTokenId() != null && certificate.getStatus() != request.getStatus()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This certificate has an on-chain record; change its state with the blockchain issue / revoke actions");
        }
        if (request.getStatus() == CertificateStatus.REVOKED && certificate.getStatus() == CertificateStatus.MINTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This certificate is minted on-chain — use the blockchain revoke action so the on-chain record stays in sync");
        }

        CertificateStatus previousStatus = certificate.getStatus();
        certificate.setStatus(request.getStatus());

        if (request.getStatus() == CertificateStatus.REVOKED) {
            certificate.setRevokedAt(LocalDateTime.now());
            certificate.setRevokedReason(request.getReason());
        } else {
            certificate.setRevokedAt(null);
            certificate.setRevokedReason(null);
        }
        certificateRepository.save(certificate);

        Admin admin = currentUserService.getCurrentAdmin();
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("from", previousStatus);
        metadata.put("to", request.getStatus());
        if (request.getReason() != null) {
            metadata.put("reason", request.getReason());
        }
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_STATUS_UPDATED",
                "CERTIFICATE",
                id.toString(),
                metadata
        );

        return CertificateResponse.from(certificate);
    }

    /**
     * Records a blockchain credential that the admin's MetaMask has already issued on-chain
     * (see frontend/src/services/blockchainService.js -> issueCredentialOnChain). This method
     * does not talk to MetaMask and does not submit any transaction — it independently verifies
     * the reported transaction really happened (BlockchainVerificationService), cross-checks it
     * against data we already had (student wallet, certificate hash), and only then saves it.
     */
    public CertificateResponse issueOnBlockchain(UUID id, IssueBlockchainRequest request) {
        Certificate certificate = findOwnOrThrow(id);

        if (certificate.getFileHash() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Upload the certificate PDF (and generate its hash) before issuing on the blockchain");
        }
        if (certificate.getStatus() == CertificateStatus.MINTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This certificate has already been issued on the blockchain");
        }
        if (certificate.getStatus() == CertificateStatus.REVOKED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This certificate has been revoked and cannot be reissued");
        }

        String studentWallet = certificate.getStudent().getWalletAddress();
        if (studentWallet == null || studentWallet.isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This student does not have a system-managed wallet on file");
        }
        if (!studentWallet.equalsIgnoreCase(request.getStudentWalletAddress())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The wallet address used on-chain does not match this student's wallet on file");
        }
        if (!certificate.getFileHash().equalsIgnoreCase(request.getCertificateHash())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The certificate hash used on-chain does not match the stored SHA-256 hash");
        }

        Institution institution = currentUserService.getCurrentInstitution();
        certificateRepository.findByTokenId(request.getTokenId()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "That on-chain token is already linked to certificate " + existing.getCertificateNumber());
            }
        });
        blockchainVerificationService.verifyContractTransaction(request.getTransactionHash(), institution.getWalletAddress());
        blockchainVerificationService.verifyIssuedCredential(
                request.getTokenId(), certificate.getId().toString(), certificate.getFileHash(), studentWallet);

        certificate.setWalletAddress(studentWallet.toLowerCase());
        certificate.setTokenId(request.getTokenId());
        certificate.setContractAddress(blockchainVerificationService.contractAddress());
        certificate.setTxHash(request.getTransactionHash());
        certificate.setStatus(CertificateStatus.MINTED);
        certificate.setMintedAt(LocalDateTime.now());
        certificateRepository.save(certificate);

        Admin admin = currentUserService.getCurrentAdmin();
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_BLOCKCHAIN_ISSUED",
                "CERTIFICATE",
                id.toString(),
                Map.of(
                        "tokenId", String.valueOf(request.getTokenId()),
                        "transactionHash", request.getTransactionHash(),
                        "studentWalletAddress", studentWallet
                )
        );

        return CertificateResponse.from(certificate);
    }

    /**
     * Records an on-chain revocation the admin's MetaMask has already submitted (see
     * blockchainService.revokeCredentialOnChain). Only a currently MINTED certificate can be
     * revoked this way — a certificate that was never minted just uses the plain
     * updateStatus() path above, unchanged from Phase 2.
     */
    public CertificateResponse revokeOnBlockchain(UUID id, RevokeBlockchainRequest request) {
        Certificate certificate = findOwnOrThrow(id);

        if (certificate.getStatus() != CertificateStatus.MINTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only a certificate that is currently MINTED on-chain can be revoked on-chain");
        }
        if (certificate.getTokenId() == null || !certificate.getTokenId().equals(request.getTokenId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Token ID does not match this certificate's on-chain record");
        }

        blockchainVerificationService.verifyContractTransaction(
                request.getTransactionHash(), currentUserService.getCurrentInstitution().getWalletAddress());
        blockchainVerificationService.verifyRevokedOnChain(request.getTokenId());

        certificate.setStatus(CertificateStatus.REVOKED);
        certificate.setRevokedAt(LocalDateTime.now());
        certificate.setRevokedReason(request.getReason());
        certificateRepository.save(certificate);

        Admin admin = currentUserService.getCurrentAdmin();
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "CERTIFICATE_BLOCKCHAIN_REVOKED",
                "CERTIFICATE",
                id.toString(),
                Map.of(
                        "tokenId", String.valueOf(request.getTokenId()),
                        "transactionHash", request.getTransactionHash(),
                        "reason", request.getReason()
                )
        );

        return CertificateResponse.from(certificate);
    }

    /** A certificate issued by the signed-in administrator's institution; anything else is a 404. */
    private Certificate findOwnOrThrow(UUID id) {
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        return certificateRepository.findByIdAndInstitutionId(id, institutionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found"));
    }

    private Certificate findOrThrow(UUID id) {
        return certificateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found"));
    }

    private void assertCanView(Certificate certificate) {
        if (currentUserService.isAdmin()) {
            Institution mine = currentUserService.getCurrentInstitution();
            if (certificate.getInstitution() != null && certificate.getInstitution().getId().equals(mine.getId())) {
                return;
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found");
        }
        if (currentUserService.isStudent()) {
            Student student = currentUserService.getCurrentStudent();
            if (certificate.getStudent().getId().equals(student.getId())) {
                if (STUDENT_VISIBLE.contains(certificate.getStatus())) {
                    return;
                }
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found");
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this certificate");
    }

    private String generateCertificateNumber(int year) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        return "SKC-" + year + "-" + suffix;
    }
}
