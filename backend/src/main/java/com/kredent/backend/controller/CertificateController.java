package com.kredent.backend.controller;

import com.kredent.backend.dto.CertificateResponse;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.service.CertificateFile;
import com.kredent.backend.service.CertificateService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Certificate endpoints that don't fit cleanly under one role prefix.
 * GET /api/certificates/{id} is reachable by any authenticated user (falls
 * under SecurityConfig's anyRequest().authenticated()); ownership is then
 * enforced inside CertificateService, not by the URL pattern.
 */
@RestController
public class CertificateController {

    private final CertificateService certificateService;

    public CertificateController(CertificateService certificateService) {
        this.certificateService = certificateService;
    }

    @GetMapping("/api/certificates/{id}")
    public ResponseEntity<CertificateResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(certificateService.getById(id));
    }

    @GetMapping("/api/student/certificates")
    public ResponseEntity<PageResponse<CertificateResponse>> getOwnCertificates(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("issuedAt").descending());
        return ResponseEntity.ok(certificateService.getOwnCertificates(pageable));
    }

    /** Admin can download any certificate; a student can only download their own — enforced in the service. */
    @GetMapping("/api/certificates/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        CertificateFile file = certificateService.downloadFile(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(file.filename()).build().toString())
                .body(file.content());
    }
}
