package com.kredent.backend.controller;

import com.kredent.backend.dto.NotificationResponse;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.service.NotificationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Shared/student-facing notification endpoints. GET/PATCH/DELETE by id are
 * reachable by any authenticated user (anyRequest().authenticated()); the
 * service enforces "must be the owning student, or an admin" itself.
 */
@RestController
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/api/student/notifications")
    public ResponseEntity<PageResponse<NotificationResponse>> getOwnNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());
        return ResponseEntity.ok(notificationService.getOwnNotifications(pageable));
    }

    @GetMapping("/api/notifications/{id}")
    public ResponseEntity<NotificationResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.getById(id));
    }

    @PatchMapping("/api/notifications/{id}/read")
    public ResponseEntity<NotificationResponse> markRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markRead(id));
    }

    @DeleteMapping("/api/notifications/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        notificationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
