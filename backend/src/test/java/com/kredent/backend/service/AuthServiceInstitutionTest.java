package com.kredent.backend.service;

import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.LoginRequest;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.Student;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.registry.RegistryStatus;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.repository.StudentRepository;
import com.kredent.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Students belong to a college: registration and sign-in are tied to the chosen institution. */
class AuthServiceInstitutionTest {

    private StudentRepository studentRepository;
    private InstitutionRepository institutionRepository;
    private InstitutionAccessService accessService;
    private WalletService walletService;
    private JwtService jwtService;
    private BCryptPasswordEncoder encoder;
    private AuthService service;
    private Institution institution;

    @BeforeEach
    void setUp() {
        studentRepository = mock(StudentRepository.class);
        institutionRepository = mock(InstitutionRepository.class);
        accessService = mock(InstitutionAccessService.class);
        walletService = mock(WalletService.class);
        jwtService = mock(JwtService.class);
        encoder = new BCryptPasswordEncoder(4);

        institution = new Institution();
        institution.setId(7L);
        institution.setRegistryInstitutionId("INST-1");
        institution.setName("Greenfield Institute");
        institution.setState("Karnataka");
        institution.setDistrict("Bengaluru");
        institution.setVerified(true);
        institution.setVerifiedAt(LocalDateTime.now());
        institution.setWalletAddress("0x1111111111111111111111111111111111111111");
        institution.setWalletLinkedAt(LocalDateTime.now());

        when(accessService.requireApprovedInRegistry(anyString())).thenReturn(new RegistryInstitution(
                1L, "INST-1", "Greenfield Institute", "Karnataka", "Bengaluru", "HOI", "h@x.example", "1", "h",
                RegistryStatus.APPROVED, true, Instant.now()));
        when(institutionRepository.findByRegistryInstitutionId("INST-1")).thenReturn(Optional.of(institution));
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("jwt");

        service = new AuthService(studentRepository, encoder, jwtService, walletService, mock(EmailService.class),
                accessService, institutionRepository);
    }

    private RegisterRequest request(String institutionId) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Asha Rao");
        r.setUsn("1AB21CS001");
        r.setEmail("Asha@Example.edu");
        r.setPhone("9999999999");
        r.setDepartment("CSE");
        r.setPassword("Passw0rd!");
        r.setInstitutionId(institutionId);
        return r;
    }

    @Test
    void registrationRequiresAChosenCollege() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.register(request(" ")));
        assertEquals(HttpStatus.BAD_REQUEST.value(), e.getStatusCode().value());
        verify(studentRepository, never()).save(any());
    }

    @Test
    void registrationAtACollegeThatHasNotJoinedKredentIsRefused() {
        when(institutionRepository.findByRegistryInstitutionId("INST-1")).thenReturn(Optional.empty());
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.register(request("INST-1")));
        assertEquals(HttpStatus.CONFLICT.value(), e.getStatusCode().value());
    }

    @Test
    void registeredStudentBelongsToTheChosenCollege() {
        when(walletService.generateWallet()).thenReturn(new WalletService.GeneratedWallet("0xabc", "enc"));
        service.register(request("INST-1"));

        org.mockito.ArgumentCaptor<Student> captor = org.mockito.ArgumentCaptor.forClass(Student.class);
        verify(studentRepository).save(captor.capture());
        assertEquals(institution, captor.getValue().getInstitution());
        assertEquals("asha@example.edu", captor.getValue().getEmail());
    }

    @Test
    void usnClashIsCheckedWithinTheCollegeOnly() {
        when(studentRepository.existsByInstitutionIdAndUsn(7L, "1AB21CS001")).thenReturn(true);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.register(request("INST-1")));
        assertEquals(HttpStatus.CONFLICT.value(), e.getStatusCode().value());
    }

    private Student existingStudent() {
        Student s = new Student();
        s.setId(3L);
        s.setEmail("asha@example.edu");
        s.setFullName("Asha Rao");
        s.setPassword(encoder.encode("Passw0rd!"));
        s.setInstitution(institution);
        when(studentRepository.findByEmail("asha@example.edu")).thenReturn(Optional.of(s));
        return s;
    }

    private LoginRequest login(String email, String institutionId) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword("Passw0rd!");
        r.setInstitutionId(institutionId);
        return r;
    }

    @Test
    void signInWithTheRightCollegeSucceedsAndReturnsIt() {
        existingStudent();
        AuthResponse response = service.login(login("Asha@Example.edu", "inst-1"));
        assertEquals("jwt", response.getToken());
        assertEquals("Greenfield Institute", response.getInstitution().name());
    }

    @Test
    void signInWithAnotherCollegeIsRefused() {
        existingStudent();
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service.login(login("asha@example.edu", "INST-2")));
        assertEquals(HttpStatus.UNAUTHORIZED.value(), e.getStatusCode().value());
    }
}
