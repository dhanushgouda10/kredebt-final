package com.kredent.backend.registry;

import com.kredent.backend.registry.dto.RegistryAdminLoginRequest;
import com.kredent.backend.registry.dto.RegistryAdminLoginResponse;
import com.kredent.backend.registry.dto.RegistryEmailOtpRequest;
import com.kredent.backend.registry.dto.RegistryEmailVerifyRequest;
import com.kredent.backend.registry.dto.RegistryOtpSentResponse;
import com.kredent.backend.registry.dto.RegistryRegisterRequest;
import com.kredent.backend.registry.dto.RegistryRegisterResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Public endpoints of the simulated institutional registry (demo only — not an AICTE service).
 * Registration and email verification need no login; the registry administrator signs in separately.
 */
@RestController
@RequestMapping("/api/registry")
public class RegistryController {

    private final RegistryService registryService;

    public RegistryController(RegistryService registryService) {
        this.registryService = registryService;
    }

    @PostMapping("/institutions")
    public ResponseEntity<RegistryRegisterResponse> register(@Valid @RequestBody RegistryRegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registryService.register(request));
    }

    @PostMapping("/email/send")
    public ResponseEntity<RegistryOtpSentResponse> sendEmailOtp(@Valid @RequestBody RegistryEmailOtpRequest request) {
        return ResponseEntity.ok(registryService.resendEmailOtp(request.email()));
    }

    @PostMapping("/email/verify")
    public ResponseEntity<Map<String, Object>> verifyEmail(@Valid @RequestBody RegistryEmailVerifyRequest request) {
        String institutionId = registryService.verifyEmailOtp(request.email(), request.otp());
        return ResponseEntity.ok(Map.of(
                "verified", true,
                "institutionId", institutionId,
                "message", "Email verified. Your institutional ID is " + institutionId + "."));
    }

    @PostMapping("/admin/login")
    public ResponseEntity<RegistryAdminLoginResponse> adminLogin(@Valid @RequestBody RegistryAdminLoginRequest request) {
        return ResponseEntity.ok(registryService.adminLogin(request.email(), request.password()));
    }
}
