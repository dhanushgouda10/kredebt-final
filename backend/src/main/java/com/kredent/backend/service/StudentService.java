package com.kredent.backend.service;

import com.kredent.backend.dto.AdminUpdateStudentRequest;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.dto.StudentResponse;
import com.kredent.backend.dto.UpdateStudentProfileRequest;
import com.kredent.backend.entity.ActorType;
import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.StudentRepository;
import com.kredent.backend.util.DepartmentCatalog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
@Transactional
public class StudentService {

    private final StudentRepository studentRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;
    private final AuditLogService auditLogService;
    private final WalletService walletService;
    private final EmailService emailService;

    public StudentService(
            StudentRepository studentRepository,
            PasswordEncoder passwordEncoder,
            CurrentUserService currentUserService,
            AuditLogService auditLogService,
            WalletService walletService,
            EmailService emailService) {
        this.studentRepository = studentRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUserService = currentUserService;
        this.auditLogService = auditLogService;
        this.walletService = walletService;
        this.emailService = emailService;
    }

    /**
     * Emails are stored lowercase and trimmed so the unique constraint actually
     * bites — without this, Student@mvjce.edu.in and student@mvjce.edu.in would be
     * two distinct rows for the same mailbox.
     */
    static String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    public StudentResponse getOwnProfile() {
        return StudentResponse.from(currentUserService.getCurrentStudent());
    }

    public StudentResponse updateOwnProfile(UpdateStudentProfileRequest request) {
        Student student = currentUserService.getCurrentStudent();
        student.setFullName(request.getFullName());
        student.setPhone(request.getPhone());
        studentRepository.save(student);
        return StudentResponse.from(student);
    }

    public StudentResponse getByUsn(String usn) {
        Student student = studentRepository.findByUsn(usn)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No student with USN " + usn));
        return StudentResponse.from(student);
    }

    public PageResponse<StudentResponse> listStudents(String search, Pageable pageable) {
        Page<Student> page = (search == null || search.isBlank())
                ? studentRepository.findAll(pageable)
                : studentRepository.search(search.trim(), pageable);
        return PageResponse.from(page, StudentResponse::from);
    }

    /**
     * Department-scoped student listing — backs the admin Students page once a department is
     * selected. Search stays server-side and paginated even within a department, so the page
     * never needs to fetch a whole department's roster to filter it client-side.
     */
    public PageResponse<StudentResponse> listStudentsByDepartment(String department, String search, Pageable pageable) {
        String query = search == null ? "" : search.trim();
        Page<Student> page = studentRepository.searchByDepartment(department, query, pageable);
        return PageResponse.from(page, StudentResponse::from);
    }

    public StudentResponse getById(Long id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        return StudentResponse.from(student);
    }

    public StudentResponse adminCreateStudent(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());

        if (studentRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }
        if (studentRepository.existsByUsn(request.getUsn())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "USN already exists");
        }
        assertValidDepartment(request.getDepartment());

        Student student = new Student();
        student.setFullName(request.getFullName());
        student.setUsn(request.getUsn());
        student.setEmail(email);
        student.setPhone(request.getPhone());
        student.setDepartment(request.getDepartment());
        student.setPassword(passwordEncoder.encode(request.getPassword()));

        // Same system-managed wallet generation as self-registration (AuthService.register) —
        // an admin creating a student directly gets the same Option B wallet behavior.
        WalletService.GeneratedWallet wallet = walletService.generateWallet();
        student.setWalletAddress(wallet.getAddress());
        student.setWalletPrivateKeyEncrypted(wallet.getEncryptedPrivateKey());

        studentRepository.save(student);

        Admin admin = currentUserService.getCurrentAdmin();
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "STUDENT_CREATED",
                "STUDENT",
                String.valueOf(student.getId()),
                Map.of("usn", student.getUsn(), "email", student.getEmail(), "department", student.getDepartment())
        );

        // Notification only. sendStudentWelcome never throws, so a provider outage
        // cannot roll back the account that was just created — the admin is told
        // instead, via emailSent, so they can pass the details on manually.
        boolean emailSent = emailService.sendStudentWelcome(student);

        return StudentResponse.from(student, emailSent);
    }

    public StudentResponse adminUpdateStudent(Long studentId, AdminUpdateStudentRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));

        if (!student.getEmail().equalsIgnoreCase(request.getEmail()) && studentRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already in use by another student");
        }
        assertValidDepartment(request.getDepartment());

        student.setFullName(request.getFullName());
        student.setEmail(request.getEmail());
        student.setPhone(request.getPhone());
        student.setDepartment(request.getDepartment());
        studentRepository.save(student);

        Admin admin = currentUserService.getCurrentAdmin();
        auditLogService.record(
                ActorType.ADMIN,
                admin.getId(),
                "STUDENT_UPDATED",
                "STUDENT",
                String.valueOf(student.getId()),
                Map.of("usn", student.getUsn(), "department", student.getDepartment())
        );

        return StudentResponse.from(student);
    }

    private void assertValidDepartment(String department) {
        if (!DepartmentCatalog.isValidCode(department)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Unknown department: " + department + ". Choose one of the listed departments.");
        }
    }
}
