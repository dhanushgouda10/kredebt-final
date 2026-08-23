package com.kredent.backend.controller;

import com.kredent.backend.dto.AdminWalletLoginRequest;
import com.kredent.backend.dto.AuthResponse;
import com.kredent.backend.service.AdminAuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth/admin")
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    public AdminAuthController(AdminAuthService adminAuthService) {
        this.adminAuthService = adminAuthService;
    }

    /**
     * Step 1 of admin login: obtain the one-time challenge to sign.
     *
     * Public (covered by SecurityConfig's /api/auth/** permitAll rule). Issuing a
     * nonce authenticates nothing and reveals nothing — a challenge is returned for
     * any well-formed address, so this cannot be used to discover admin wallets.
     */
    @GetMapping("/nonce")
    public ResponseEntity<Map<String, String>> nonce(@RequestParam("address") String address) {
        return ResponseEntity.ok(Map.of("nonce", adminAuthService.issueNonce(address)));
    }

    /** Step 2: exchange the signed challenge for a session. */
    @PostMapping("/wallet-login")
    public ResponseEntity<AuthResponse> walletLogin(@Valid @RequestBody AdminWalletLoginRequest request) {
        return ResponseEntity.ok(adminAuthService.loginWithWallet(request));
    }
}
