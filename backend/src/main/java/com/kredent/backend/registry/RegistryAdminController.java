package com.kredent.backend.registry;

import com.kredent.backend.registry.dto.RegistryInstitutionView;
import com.kredent.backend.registry.dto.RegistryLogView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Registry administrator endpoints. SecurityConfig restricts /api/registry/admin/** to ROLE_REGISTRY_ADMIN. */
@RestController
@RequestMapping("/api/registry/admin")
public class RegistryAdminController {

    private final RegistryService registryService;

    public RegistryAdminController(RegistryService registryService) {
        this.registryService = registryService;
    }

    @GetMapping("/institutions")
    public ResponseEntity<List<RegistryInstitutionView>> list() {
        return ResponseEntity.ok(registryService.listInstitutions());
    }

    @PostMapping("/institutions/{institutionId}/approve")
    public ResponseEntity<RegistryInstitutionView> approve(@PathVariable String institutionId, Authentication auth) {
        return ResponseEntity.ok(registryService.approve(institutionId, auth.getName()));
    }

    @PostMapping("/institutions/{institutionId}/suspend")
    public ResponseEntity<RegistryInstitutionView> suspend(@PathVariable String institutionId, Authentication auth) {
        return ResponseEntity.ok(registryService.suspend(institutionId, auth.getName()));
    }

    @GetMapping("/logs")
    public ResponseEntity<List<RegistryLogView>> logs() {
        return ResponseEntity.ok(registryService.recentLogs());
    }
}
