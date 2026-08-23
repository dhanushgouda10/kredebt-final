package com.kredent.backend.service;

import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.LoginRequest;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.entity.Role;
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

    public AuthService(
            StudentRepository studentRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            WalletService walletService,
            EmailService emailService) {
        this.studentRepository = studentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.walletService = walletService;
        this.emailService = emailService;
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
        if (studentRepository.existsByUsn(request.getUsn())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "USN already exists");
        }
        if (!DepartmentCatalog.isValidCode(request.getDepartment())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown department: " + request.getDepartment() + ". Choose one of the listed departments.");
        }

        Student student = new Student();
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
        Student student = studentRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), student.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        String token = jwtService.generateToken(student.getEmail(), Role.STUDENT.name(), student.getId());
        return new AuthResponse(token, Role.STUDENT.name(), student.getId(), student.getFullName(), student.getEmail());
    }
}
