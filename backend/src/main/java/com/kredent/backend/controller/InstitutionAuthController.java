package com.kredent.backend.controller;

import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.dto.InstitutionCompleteRequest;
import com.kredent.backend.dto.InstitutionIdRequest;
import com.kredent.backend.dto.InstitutionLookupResponse;
import com.kredent.backend.dto.InstitutionOtpSentResponse;
import com.kredent.backend.dto.InstitutionOtpVerifyRequest;
import com.kredent.backend.dto.InstitutionOtpVerifyResponse;
import com.kredent.backend.service.InstitutionDirectoryService;
import com.kredent.backend.service.InstitutionVerificationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public (covered by SecurityConfig's /api/auth/** rule) endpoints of the college-administrator
 * onboarding flow. Each call is independently validated server-side; none trusts the previous
 * step having happened in the browser.
 */
@RestController
@RequestMapping("/api/auth/institution")
public class InstitutionAuthController {

    private final InstitutionVerificationService verificationService;
    private final InstitutionDirectoryService directoryService;

    public InstitutionAuthController(
            InstitutionVerificationService verificationService, InstitutionDirectoryService directoryService) {
        this.verificationService = verificationService;
        this.directoryService = directoryService;
    }

    /** The colleges approved in the institutional registry, for the college picker. Public; no contact details. */
    @GetMapping("/list")
    public ResponseEntity<java.util.List<com.kredent.backend.dto.CollegeOption>> list(
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(directoryService.listColleges(search));
    }

    /** Step 1-2: institutional ID in, registry details (name, state, district, HOI email) out. */
    @PostMapping("/lookup")
    public ResponseEntity<InstitutionLookupResponse> lookup(@Valid @RequestBody InstitutionIdRequest request) {
        return ResponseEntity.ok(verificationService.lookup(request.institutionId()));
    }

    /** Step 3: email a six-digit OTP to the registry's HOI address. The response never contains the OTP. */
    @PostMapping("/otp/send")
    public ResponseEntity<InstitutionOtpSentResponse> sendOtp(@Valid @RequestBody InstitutionIdRequest request) {
        return ResponseEntity.ok(verificationService.sendOtp(request.institutionId()));
    }

    /** Step 4: check the OTP; on success the institution is marked verified. */
    @PostMapping("/otp/verify")
    public ResponseEntity<InstitutionOtpVerifyResponse> verifyOtp(@Valid @RequestBody InstitutionOtpVerifyRequest request) {
        return ResponseEntity.ok(verificationService.verifyOtp(request.sessionId(), request.otp()));
    }

    /** Step 5: link the signed-in MetaMask wallet, register the institution and open a session. */
    @PostMapping("/complete")
    public ResponseEntity<AuthResponse> complete(@Valid @RequestBody InstitutionCompleteRequest request) {
        return ResponseEntity.ok(verificationService.completeRegistration(
                request.sessionId(), request.walletAddress(), request.signature()));
    }
}
