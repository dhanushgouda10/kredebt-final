package com.kredent.backend.service;

import com.kredent.backend.dto.CertificateMetadataRequest;
import com.kredent.backend.dto.IssueBlockchainRequest;
import com.kredent.backend.dto.UpdateCertificateStatusRequest;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Certificate;
import com.kredent.backend.entity.CertificateStatus;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.StudentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Institution isolation and on-chain integrity rules of CertificateService. */
class CertificateServiceTest {

    private static final String WALLET = "0x1111111111111111111111111111111111111111";
    private static final String STUDENT_WALLET = "0x2222222222222222222222222222222222222222";

    private CertificateRepository certificateRepository;
    private StudentRepository studentRepository;
    private CurrentUserService currentUserService;
    private BlockchainVerificationService blockchain;
    private CertificateService service;
    private Institution institution;

    @BeforeEach
    void setUp() {
        certificateRepository = mock(CertificateRepository.class);
        studentRepository = mock(StudentRepository.class);
        currentUserService = mock(CurrentUserService.class);
        blockchain = mock(BlockchainVerificationService.class);

        institution = new Institution();
        institution.setId(7L);
        institution.setRegistryInstitutionId("INST-1");
        institution.setName("Greenfield Institute");
        institution.setWalletAddress(WALLET);
        when(currentUserService.getCurrentInstitution()).thenReturn(institution);
        when(currentUserService.getCurrentAdmin()).thenReturn(mock(Admin.class));

        service = new CertificateService(
                certificateRepository, studentRepository, currentUserService, mock(AuditLogService.class),
                mock(SupabaseStorageService.class), blockchain, mock(PdfStampingService.class), new com.kredent.backend.service.CertificateRenderer(), 5, "http://localhost:5173");
    }

    private Certificate certificate(CertificateStatus status, Long tokenId) {
        Student student = new Student();
        student.setId(3L);
        student.setUsn("1AB21CS001");
        student.setWalletAddress(STUDENT_WALLET);
        Certificate c = new Certificate();
        c.setId(UUID.randomUUID());
        c.setCertificateNumber("SKC-2026-ABCD1234");
        c.setStudent(student);
        c.setInstitution(institution);
        Admin issuer = new Admin();
        issuer.setId(1L);
        c.setIssuedByAdmin(issuer);
        c.setStatus(status);
        c.setFileHash("ab".repeat(32));
        c.setTokenId(tokenId);
        return c;
    }

    private void owns(Certificate c) {
        when(certificateRepository.findByIdAndInstitutionId(c.getId(), 7L)).thenReturn(Optional.of(c));
    }

    private static HttpStatus statusOf(ResponseStatusException e) {
        return HttpStatus.valueOf(e.getStatusCode().value());
    }

    @Test
    void cannotIssueACertificateToAStudentOfAnotherInstitution() {
        when(studentRepository.findByIdAndInstitutionId(99L, 7L)).thenReturn(Optional.empty());
        CertificateMetadataRequest request = mock(CertificateMetadataRequest.class);
        when(request.getStudentId()).thenReturn(99L);

        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.createMetadata(request));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(e));
        verify(certificateRepository, never()).save(any());
    }

    @Test
    void anotherInstitutionsCertificateIsNotFound() {
        UUID foreign = UUID.randomUUID();
        when(certificateRepository.findByIdAndInstitutionId(foreign, 7L)).thenReturn(Optional.empty());

        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.deleteMetadata(foreign));
        assertEquals(HttpStatus.NOT_FOUND, statusOf(e));
    }

    @Test
    void statusCannotBeForcedToMinted() {
        Certificate c = certificate(CertificateStatus.PENDING_MINT, null);
        owns(c);
        UpdateCertificateStatusRequest request = new UpdateCertificateStatusRequest();
        request.setStatus(CertificateStatus.MINTED);

        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.updateStatus(c.getId(), request));
        assertEquals(HttpStatus.CONFLICT, statusOf(e));
        verify(certificateRepository, never()).save(any());
    }

    @Test
    void onChainCertificateStatusCannotBeEditedByHand() {
        Certificate c = certificate(CertificateStatus.REVOKED, 5L);
        owns(c);
        UpdateCertificateStatusRequest request = new UpdateCertificateStatusRequest();
        request.setStatus(CertificateStatus.PENDING_MINT);

        assertEquals(HttpStatus.CONFLICT,
                statusOf(assertThrows(ResponseStatusException.class, () -> service.updateStatus(c.getId(), request))));
    }

    @Test
    void mintedCertificateCannotBeDeletedOrReuploaded() {
        Certificate c = certificate(CertificateStatus.MINTED, 5L);
        owns(c);

        assertEquals(HttpStatus.CONFLICT,
                statusOf(assertThrows(ResponseStatusException.class, () -> service.deleteMetadata(c.getId()))));
        MockMultipartFile file = new MockMultipartFile("file", "x.pdf", "application/pdf", "%PDF-1.4".getBytes());
        assertEquals(HttpStatus.CONFLICT,
                statusOf(assertThrows(ResponseStatusException.class, () -> service.uploadFile(c.getId(), file))));
        verify(certificateRepository, never()).delete(any());
    }

    @Test
    void issuingChecksTheInstitutionWalletAndTheOnChainRecord() {
        Certificate c = certificate(CertificateStatus.PENDING_MINT, null);
        owns(c);
        when(certificateRepository.findByTokenId(anyLong())).thenReturn(Optional.empty());
        when(blockchain.contractAddress()).thenReturn("0xcontract");

        IssueBlockchainRequest request = new IssueBlockchainRequest();
        request.setStudentWalletAddress(STUDENT_WALLET);
        request.setCertificateHash(c.getFileHash());
        request.setTokenId(5L);
        request.setContractAddress("0xattacker-supplied");
        request.setTransactionHash("0xtx");

        service.issueOnBlockchain(c.getId(), request);

        verify(blockchain).verifyContractTransaction("0xtx", WALLET);
        verify(blockchain).verifyIssuedCredential(5L, c.getId().toString(), c.getFileHash(), STUDENT_WALLET);
        assertEquals(CertificateStatus.MINTED, c.getStatus());
        // the stored contract address comes from server config, never from the request
        assertEquals("0xcontract", c.getContractAddress());
    }

    @Test
    void aTokenAlreadyLinkedToAnotherCertificateIsRejected() {
        Certificate c = certificate(CertificateStatus.PENDING_MINT, null);
        owns(c);
        Certificate other = certificate(CertificateStatus.MINTED, 5L);
        when(certificateRepository.findByTokenId(5L)).thenReturn(Optional.of(other));

        IssueBlockchainRequest request = new IssueBlockchainRequest();
        request.setStudentWalletAddress(STUDENT_WALLET);
        request.setCertificateHash(c.getFileHash());
        request.setTokenId(5L);
        request.setContractAddress("0xcontract");
        request.setTransactionHash("0xtx");

        assertEquals(HttpStatus.CONFLICT,
                statusOf(assertThrows(ResponseStatusException.class, () -> service.issueOnBlockchain(c.getId(), request))));
        verify(blockchain, never()).verifyContractTransaction(anyString(), anyString());
    }
}
