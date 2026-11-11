package com.kredent.backend.service;

import com.kredent.backend.entity.Admin;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.AdminRepository;
import com.kredent.backend.repository.InstitutionRepository;
import com.kredent.backend.repository.StudentRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.server.ResponseStatusException;
import com.kredent.backend.util.SecurityConstants;

/**
 * Resolves the full Student/Admin entity for the currently authenticated
 * request. This only *reads* the Authentication that JwtAuthFilter already
 * put in the SecurityContext — it doesn't change how authentication works,
 * so JWT/Spring Security itself is untouched.
 *
 * The JWT subject is the student's email or the admin's wallet address (see
 * JwtService/AuthService/AdminAuthService); this class re-resolves that
 * subject to a real entity so services can get an actual id for ownership
 * checks and audit logging.
 */
@Service
public class CurrentUserService {

    private final StudentRepository studentRepository;
    private final AdminRepository adminRepository;
    private final InstitutionRepository institutionRepository;

    public CurrentUserService(
            StudentRepository studentRepository,
            AdminRepository adminRepository,
            InstitutionRepository institutionRepository) {
        this.studentRepository = studentRepository;
        this.adminRepository = adminRepository;
        this.institutionRepository = institutionRepository;
    }

    public Student getCurrentStudent() {
        String email = currentSubject();
        return studentRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Student session is no longer valid"));
    }

    public Admin getCurrentAdmin() {
        String wallet = currentSubject();
        return adminRepository.findByWalletAddress(wallet)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin session is no longer valid"));
    }

    /**
     * The institution the current administrator signed in for (from the token's institutionId claim,
     * already re-validated against the registry by AdminInstitutionGuardFilter on admin requests).
     */
    public Institution getCurrentInstitution() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        Object id = attributes == null ? null
                : attributes.getAttribute(SecurityConstants.INSTITUTION_ID_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        if (!(id instanceof Long institutionId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This session is not linked to a verified institution");
        }
        return institutionRepository.findById(institutionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "This session is not linked to a verified institution"));
    }

    public boolean isAdmin() {
        return hasAuthority("ROLE_ADMIN");
    }

    public boolean isStudent() {
        return hasAuthority("ROLE_STUDENT");
    }

    private boolean hasAuthority(String authority) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority::equals);
    }

    private String currentSubject() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        return auth.getName();
    }
}
