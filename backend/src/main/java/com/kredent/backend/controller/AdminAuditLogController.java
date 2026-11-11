package com.kredent.backend.controller;

import com.kredent.backend.dto.AuditLogResponse;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.service.AuditLogService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only admin Audit Logs page (Phase 12). Admin-only — already enforced by SecurityConfig's
 * existing `.requestMatchers("/api/admin/**").hasRole("ADMIN")` rule, so no security config
 * change was needed for this endpoint. No create/update/delete here on purpose: audit entries are
 * append-only and are only ever written by AuditLogService.record() from inside the services that
 * perform the audited action (see CertificateService, StudentService) — never from a controller.
 */
@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditLogController {

    private final AuditLogService auditLogService;

    public AdminAuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<AuditLogResponse>> listAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());
        // search/action/department are the Audit Logs page's filter strip — all optional, all
        // applied server-side (AuditLogService.listFiltered) once any of them is set, so the page
        // never needs to fetch more than one page of rows to filter or search.
        return ResponseEntity.ok(auditLogService.listFiltered(action, department, search, pageable));
    }
}
