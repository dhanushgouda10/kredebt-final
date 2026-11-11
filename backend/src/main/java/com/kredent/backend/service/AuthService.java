package com.kredent.backend.service;

import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.LoginRequest;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.entity.Role;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.dto.InstitutionSummary;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.StudentRepository;
import com.kredent.backend.security.JwtService;
import com.kredent.backend.util.DepartmentCatalog;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    private final StudentRepository studentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final WalletService walletService;
    private final EmailService emailService;
    private final InstitutionAccessService institutionAccessService;
    private final InstitutionRepository institutionRepository;

    public AuthService(
            StudentRepository studentRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            WalletService walletService,
            EmailService emailService,
            InstitutionAccessService institutionAccessService,
            InstitutionRepository institutionRepository) {
        this.studentRepository = studentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.walletService = walletService;
        this.emailService = emailService;
        this.institutionAccessService = institutionAccessService;
        this.institutionRepository = institutionRepository;
    }

    /**
     * @return true if the welcome email was accepted by the provider. Registration
     *         itself succeeds regardless — the flag is informational.
     */
    public boolean register(RegisterRequest request) {
        String email = StudentService.normalizeEmail(request.getEmail());
        if (studentRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        Institution institution = resolveJoinedInstitution(request.getInstitutionId());
        if (studentRepository.existsByInstitutionIdAndUsn(institution.getId(), request.getUsn())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "USN already exists at this institution");
        }
        if (!DepartmentCatalog.isValidCode(request.getDepartment())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown department: " + request.getDepartment() + ". Choose one of the listed departments.");
        }

        Student student = new Student();
        student.setInstitution(institution);
        student.setFullName(request.getFullName());
        student.setUsn(request.getUsn());
        student.setEmail(email);
        student.setPhone(request.getPhone());
        student.setDepartment(request.getDepartment());
        student.setPassword(passwordEncoder.encode(request.getPassword()));

        // Phase 3, "Option B": every student gets a system-managed blockchain wallet the
        // moment their account is created. The student never sees or handles the private key.
        WalletService.GeneratedWallet wallet = walletService.generateWallet();
        student.setWalletAddress(wallet.getAddress());
        student.setWalletPrivateKeyEncrypted(wallet.getEncryptedPrivateKey());

        studentRepository.save(student);

        return emailService.sendStudentWelcome(student);
    }

    public AuthResponse login(LoginRequest request) {
        Student student = studentRepository.findByEmail(StudentService.normalizeEmail(request.getEmail()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"));
        if (!passwordEncoder.matches(request.getPassword(), student.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        // The college chosen on the sign-in screen must be the one this account belongs to. Checked
        // only after the password so the response never reveals which college an email belongs to.
        String chosen = request.getInstitutionId();
        if (chosen != null && !chosen.isBlank()) {
            String own = student.getInstitution() == null ? null : student.getInstitution().getRegistryInstitutionId();
            if (own == null || !own.equalsIgnoreCase(RegistryService.normalizeInstitutionId(chosen))) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "This account is not registered at the selected college");
            }
        }
        String token = jwtService.generateToken(student.getEmail(), Role.STUDENT.name(), student.getId());
        AuthResponse response = new AuthResponse(token, Role.STUDENT.name(), student.getId(), student.getFullName(), student.getEmail());
        if (student.getInstitution() != null) {
            response.setInstitution(InstitutionSummary.from(student.getInstitution()));
        }
        return response;
    }

    /** The college a student registers at: approved in the registry AND already onboarded on Kredent. */
    private Institution resolveJoinedInstitution(String rawInstitutionId) {
        if (rawInstitutionId == null || rawInstitutionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose your college from the list.");
        }
        RegistryInstitution registry = institutionAccessService.requireApprovedInRegistry(rawInstitutionId);
        Institution institution = institutionRepository.findByRegistryInstitutionId(registry.institutionId())
                .filter(Institution::isOnboarded)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        registry.collegeName() + " has not joined Kredent yet. Ask your college administrator to complete "
                                + "institution verification first."));
        return institution;
    }
}
