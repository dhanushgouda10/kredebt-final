package com.kredent.backend.service;

import com.kredent.backend.dto.PdfVerificationResponse;
import com.kredent.backend.dto.PublicVerificationResponse;
import com.kredent.backend.entity.Certificate;
import com.kredent.backend.entity.CertificateStatus;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.util.FileValidationUtil;
import com.kredent.backend.util.HashUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Optional;

/**
 * Backs the public, unauthenticated GET /api/verify/{certificateNumber} endpoint (no JWT, no
 * login — anyone with a certificate number can call it, by design). This is the one place in the
 * app that answers "is this certificate real" for someone who isn't the student or an admin, so
 * it deliberately never trusts PostgreSQL alone: a MINTED certificate is only ever reported
 * VERIFIED after an independent, live read of the deployed contract (BlockchainVerificationService
 * .readCredential) confirms it isn't revoked on-chain and that its on-chain hash/recipient match
 * what's stored here. If that on-chain read can't be completed for any reason (RPC down, etc.),
 * the result is UNAVAILABLE — never VERIFIED.
 *
 * @Transactional(readOnly = true) for the same reason CertificateService is transactional:
 * Certificate.student is a lazy association, and baseResponse() below touches student.fullName —
 * that needs an open Hibernate session for the whole method, not just for the repository call.
 */
@Service
@Transactional(readOnly = true)
public class PublicVerificationService {

    private static final Logger log = LoggerFactory.getLogger(PublicVerificationService.class);

    // Shown only for certificates issued before multi-institution support (no institution recorded).
    private static final String LEGACY_INSTITUTION_NAME = "Issuing institution";
    private static final String NETWORK_DISPLAY_NAME = "Polygon Amoy";

    private final CertificateRepository certificateRepository;
    private final BlockchainVerificationService blockchainVerificationService;
    // Reuses the exact same business limit CertificateService enforces on the admin upload path
    // (app.certificate.max-file-size-mb, default 5MB) — one config value, one meaning, everywhere
    // a certificate PDF is accepted. Spring's own multipart ceiling (spring.servlet.multipart.max-
    // file-size, 20MB) still applies underneath this as a hard backstop either way.
    private final long maxFileSizeBytes;

    public PublicVerificationService(
            CertificateRepository certificateRepository,
            BlockchainVerificationService blockchainVerificationService,
            @Value("${app.certificate.max-file-size-mb:5}") long maxFileSizeMb) {
        this.certificateRepository = certificateRepository;
        this.blockchainVerificationService = blockchainVerificationService;
        this.maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
    }

    public PublicVerificationResponse verify(String certificateNumber) {
        if (certificateNumber == null || certificateNumber.isBlank()) {
            return PublicVerificationResponse.notFound(certificateNumber);
        }

        Optional<Certificate> found = certificateRepository.findByCertificateNumber(certificateNumber.trim());
        if (found.isEmpty()) {
            return PublicVerificationResponse.notFound(certificateNumber);
        }

        Certificate certificate = found.get();
        PublicVerificationResponse dto = baseResponse(certificate);

        if (certificate.getStatus() == CertificateStatus.REVOKED) {
            dto.setResult(PublicVerificationResponse.Result.REVOKED);
            dto.setMessage(certificate.getRevokedReason() != null && !certificate.getRevokedReason().isBlank()
                    ? "This certificate has been revoked by the institution: " + certificate.getRevokedReason()
                    : "This certificate has been revoked by the institution.");
            return dto;
        }

        if (certificate.getStatus() != CertificateStatus.MINTED) {
            dto.setResult(PublicVerificationResponse.Result.INVALID);
            dto.setMessage("This certificate has not yet been issued on the blockchain and cannot be verified.");
            return dto;
        }

        // MINTED — the one case where we independently re-check the chain rather than trusting
        // the database's say-so.
        if (certificate.getTokenId() == null) {
            log.warn("Certificate {} is MINTED but has no tokenId on file — treating as unavailable", certificateNumber);
            dto.setResult(PublicVerificationResponse.Result.UNAVAILABLE);
            dto.setMessage("Blockchain verification could not be completed right now. Please try again shortly.");
            return dto;
        }

        Optional<BlockchainVerificationService.OnChainCredential> onChain =
                blockchainVerificationService.readCredential(certificate.getTokenId());

        if (onChain.isEmpty()) {
            dto.setResult(PublicVerificationResponse.Result.UNAVAILABLE);
            dto.setMessage("Blockchain verification could not be completed right now. Please try again shortly.");
            return dto;
        }

        BlockchainVerificationService.OnChainCredential credential = onChain.get();

        if (credential.revoked()) {
            dto.setResult(PublicVerificationResponse.Result.REVOKED);
            dto.setMessage("This certificate has been revoked on the blockchain.");
            return dto;
        }

        boolean hashMatches = credential.certificateHash() != null
                && credential.certificateHash().equalsIgnoreCase(certificate.getFileHash());
        boolean walletMatches = certificate.getWalletAddress() == null
                || credential.studentWallet().equalsIgnoreCase(certificate.getWalletAddress());

        if (!hashMatches || !walletMatches) {
            log.warn("Certificate {} on-chain data does not match stored data (hashMatches={}, walletMatches={})",
                    certificateNumber, hashMatches, walletMatches);
            dto.setResult(PublicVerificationResponse.Result.INVALID);
            dto.setMessage("Certificate data does not match the blockchain record. This certificate may have been altered.");
            return dto;
        }

        dto.setResult(PublicVerificationResponse.Result.VERIFIED);
        dto.setMessage("This certificate is authentic and has not been revoked.");
        return dto;
    }

    /**
     * Backs the public POST /api/verify/{certificateNumber}/pdf endpoint. HR (or anyone with the
     * PDF and the certificate number) uploads a copy of the certificate; this re-hashes the
     * uploaded bytes with the exact same HashUtil.sha256Hex used at issue time
     * (CertificateService.uploadFile) and compares against the fileHash already stored for that
     * certificate. It deliberately does NOT touch the blockchain — that independent on-chain
     * check already lives in verify() above; this endpoint answers a narrower question ("is this
     * specific file byte-for-byte the one the college issued"), not "is this certificate valid".
     *
     * Throws (rather than returning a result DTO) for cases that aren't really a verification
     * verdict at all — no such certificate, no official copy on file yet, a non-PDF upload, or a
     * file over the size limit — since those are request errors, not "TAMPERED".
     */
    public PdfVerificationResponse verifyPdf(String certificateNumber, MultipartFile file) {
        if (certificateNumber == null || certificateNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No certificate was found with this certificate number.");
        }

        Certificate certificate = certificateRepository.findByCertificateNumber(certificateNumber.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No certificate was found with this certificate number."));

        if (certificate.getStatus() == CertificateStatus.REVOKED) {
            return PdfVerificationResponse.revoked(certificate.getRevokedReason());
        }

        if (certificate.getFileHash() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No official PDF has been uploaded for this certificate yet — nothing to compare against.");
        }

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file was uploaded, or the file is empty");
        }
        // Same two-layer check as the admin upload path: don't trust the declared Content-Type
        // (trivially spoofed), and don't trust the filename/extension either — both are checked
        // against the actual bytes below.
        if (!FileValidationUtil.isDeclaredPdf(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are accepted");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "File exceeds the maximum allowed size of " + (maxFileSizeBytes / (1024 * 1024)) + "MB");
        }

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

        // The hash is computed from the uploaded bytes themselves, not the filename or any
        // client-supplied metadata — this is what makes the check meaningful.
        String uploadedHash = HashUtil.sha256Hex(content);

        return uploadedHash.equalsIgnoreCase(certificate.getFileHash())
                ? PdfVerificationResponse.authentic()
                : PdfVerificationResponse.tampered();
    }

    private PublicVerificationResponse baseResponse(Certificate certificate) {
        PublicVerificationResponse dto = new PublicVerificationResponse();
        dto.setCertificateNumber(certificate.getCertificateNumber());
        dto.setStudentName(certificate.getStudent().getFullName());
        dto.setDegreeName(certificate.getDegreeName());
        dto.setDepartment(certificate.getDepartment());
        dto.setInstitution(certificate.getInstitution() != null
                ? certificate.getInstitution().getName()
                : LEGACY_INSTITUTION_NAME);
        dto.setYearOfCompletion(certificate.getYearOfCompletion());
        dto.setIssuedAt(certificate.getIssuedAt());
        dto.setCertificateStatus(certificate.getStatus().name());
        dto.setCertificateHash(certificate.getFileHash());
        dto.setNetwork(NETWORK_DISPLAY_NAME);
        dto.setContractAddress(certificate.getContractAddress());
        dto.setTokenId(certificate.getTokenId());
        dto.setTransactionHash(certificate.getTxHash());
        dto.setMintedAt(certificate.getMintedAt());
        return dto;
    }
}
