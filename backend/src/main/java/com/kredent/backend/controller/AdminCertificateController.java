package com.kredent.backend.controller;

import com.kredent.backend.dto.CertificateMetadataRequest;
import com.kredent.backend.dto.CertificateResponse;
import com.kredent.backend.dto.IssueBlockchainRequest;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.dto.RevokeBlockchainRequest;
import com.kredent.backend.dto.UpdateCertificateStatusRequest;
import com.kredent.backend.entity.CertificateStatus;
import com.kredent.backend.service.CertificateService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminCertificateController {

    private final CertificateService certificateService;

    public AdminCertificateController(CertificateService certificateService) {
        this.certificateService = certificateService;
    }

    @PostMapping("/certificates")
    public ResponseEntity<CertificateResponse> createMetadata(@Valid @RequestBody CertificateMetadataRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(certificateService.createMetadata(request));
    }

    @GetMapping("/certificates")
    public ResponseEntity<PageResponse<CertificateResponse>> listAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) CertificateStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("issuedAt").descending());
        // department/year/status are the Certificate Registry's filter strip — all optional, all
        // applied server-side (CertificateService.listFiltered). Falls back to the plain
        // search-only path when none of them are set, so existing callers keep working unchanged.
        if (department != null || year != null || status != null) {
            return ResponseEntity.ok(certificateService.listFiltered(department, year, status, search, pageable));
        }
        return ResponseEntity.ok(certificateService.listAll(search, pageable));
    }

    @DeleteMapping("/certificates/{id}")
    public ResponseEntity<Void> deleteMetadata(@PathVariable UUID id) {
        certificateService.deleteMetadata(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/certificates/{id}/status")
    public ResponseEntity<CertificateResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateCertificateStatusRequest request) {
        return ResponseEntity.ok(certificateService.updateStatus(id, request));
    }

    @PostMapping(value = "/certificates/{id}/upload", consumes = "multipart/form-data")
    public ResponseEntity<CertificateResponse> uploadFile(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(certificateService.uploadFile(id, file));
    }

    /** Re-creates a lost generated PDF in storage — only succeeds if it matches the recorded hash. */
    @PostMapping("/certificates/{id}/restore-file")
    public ResponseEntity<CertificateResponse> restoreFile(@PathVariable UUID id) {
        return ResponseEntity.ok(certificateService.restoreFile(id));
    }

    /** Watermarked sample of the standard certificate for this college — nothing is created or stored. */
    @GetMapping("/certificate-preview")
    public ResponseEntity<byte[]> previewSample() {
        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                .header("Content-Disposition", "inline; filename=\"sample-certificate.pdf\"")
                .header("Cache-Control", "no-store")
                .body(certificateService.previewSample());
    }

    /** Draws the standard certificate from the student's record, adds the QR, hashes and stores it. */
    @PostMapping("/certificates/{id}/generate")
    public ResponseEntity<CertificateResponse> generateFile(@PathVariable UUID id) {
        return ResponseEntity.ok(certificateService.generateFile(id));
    }

    /**
     * Called AFTER the admin's MetaMask has already signed and mined the issueCredential()
     * transaction directly from the browser (see frontend blockchainService.js). This endpoint
     * never talks to MetaMask and never submits a transaction — it verifies and records one.
     */
    @PostMapping("/certificates/{id}/blockchain/issue")
    public ResponseEntity<CertificateResponse> issueOnBlockchain(
            @PathVariable UUID id,
            @Valid @RequestBody IssueBlockchainRequest request) {
        return ResponseEntity.ok(certificateService.issueOnBlockchain(id, request));
    }

    /** Same idea as issueOnBlockchain, but for a revokeCredential() transaction the admin already submitted. */
    @PostMapping("/certificates/{id}/blockchain/revoke")
    public ResponseEntity<CertificateResponse> revokeOnBlockchain(
            @PathVariable UUID id,
            @Valid @RequestBody RevokeBlockchainRequest request) {
        return ResponseEntity.ok(certificateService.revokeOnBlockchain(id, request));
    }

    @GetMapping("/students/{studentId}/certificates")
    public ResponseEntity<PageResponse<CertificateResponse>> getCertificatesForStudent(
            @PathVariable Long studentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("issuedAt").descending());
        return ResponseEntity.ok(certificateService.getCertificatesForStudent(studentId, pageable));
    }
}
