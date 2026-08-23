package com.kredent.backend.controller;

import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.LoginRequest;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.service.AuthService;
import com.kredent.backend.util.DepartmentCatalog;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        boolean emailSent = authService.register(request);
        // Existing Map<String,String> shape preserved; emailSent is additive so any
        // client that ignores it keeps working exactly as before.
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", emailSent
                        ? "Registration successful. A confirmation email has been sent."
                        : "Registration successful.",
                "emailSent", String.valueOf(emailSent)));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    // GET /api/auth/departments — public (already covered by SecurityConfig's /api/auth/**
    // permitAll rule, so no security config change was needed). Lets the self-registration form
    // populate a real department dropdown from the same DepartmentCatalog the backend validates
    // against, instead of a separately hardcoded/invented list. Deliberately excludes per-department
    // student counts (unlike GET /api/admin/departments) since this is reachable by anyone, not just admins.
    @GetMapping("/departments")
    public ResponseEntity<List<DepartmentCatalog.Department>> departments() {
        return ResponseEntity.ok(DepartmentCatalog.all());
    }
}
