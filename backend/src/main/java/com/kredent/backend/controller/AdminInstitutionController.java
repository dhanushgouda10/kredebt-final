package com.kredent.backend.controller;

import com.kredent.backend.dto.InstitutionSummary;
import com.kredent.backend.service.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in administrator's own institution — drives the dashboard header and sidebar. */
@RestController
@RequestMapping("/api/admin/institution")
public class AdminInstitutionController {

    private final CurrentUserService currentUserService;

    public AdminInstitutionController(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public ResponseEntity<InstitutionSummary> current() {
        return ResponseEntity.ok(InstitutionSummary.from(currentUserService.getCurrentInstitution()));
    }
}
