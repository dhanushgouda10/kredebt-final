package com.kredent.backend.service;

import com.kredent.backend.dto.NotificationRequest;
import com.kredent.backend.dto.NotificationResponse;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.entity.Certificate;
import com.kredent.backend.entity.Notification;
import com.kredent.backend.entity.Student;
import com.kredent.backend.repository.CertificateRepository;
import com.kredent.backend.repository.NotificationRepository;
import com.kredent.backend.repository.StudentRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Plain CRUD only, as scoped for this module — nothing here sends an email,
 * a push notification, or auto-creates a row when a certificate is issued.
 * That wiring is a deliberate follow-up once real notification rules exist.
 */
@Transactional
@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final StudentRepository studentRepository;
    private final CertificateRepository certificateRepository;
    private final CurrentUserService currentUserService;

    public NotificationService(
            NotificationRepository notificationRepository,
            StudentRepository studentRepository,
            CertificateRepository certificateRepository,
            CurrentUserService currentUserService) {
        this.notificationRepository = notificationRepository;
        this.studentRepository = studentRepository;
        this.certificateRepository = certificateRepository;
        this.currentUserService = currentUserService;
    }

    public NotificationResponse create(NotificationRequest request) {
        // Administrators may only notify their own institution's students about their own certificates.
        Long institutionId = currentUserService.getCurrentInstitution().getId();
        Student student = studentRepository.findByIdAndInstitutionId(request.getStudentId(), institutionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));

        Certificate certificate = null;
        if (request.getCertificateId() != null) {
            certificate = certificateRepository.findByIdAndInstitutionId(request.getCertificateId(), institutionId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Certificate not found"));
        }

        Notification notification = new Notification();
        notification.setStudent(student);
        notification.setCertificate(certificate);
        notification.setType(request.getType());
        notification.setTitle(request.getTitle());
        notification.setMessage(request.getMessage());
        notificationRepository.save(notification);

        return NotificationResponse.from(notification);
    }

    public PageResponse<NotificationResponse> getOwnNotifications(Pageable pageable) {
        Student student = currentUserService.getCurrentStudent();
        Page<Notification> page = notificationRepository.findByStudentId(student.getId(), pageable);
        return PageResponse.from(page, NotificationResponse::from);
    }

    public NotificationResponse getById(Long id) {
        Notification notification = findOrThrow(id);
        assertCanAccess(notification);
        return NotificationResponse.from(notification);
    }

    public NotificationResponse markRead(Long id) {
        Notification notification = findOrThrow(id);
        if (!currentUserService.isStudent() || !isOwner(notification)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the recipient can mark this as read");
        }
        notification.setRead(true);
        notificationRepository.save(notification);
        return NotificationResponse.from(notification);
    }

    public void delete(Long id) {
        Notification notification = findOrThrow(id);
        assertCanAccess(notification);
        notificationRepository.delete(notification);
    }

    private Notification findOrThrow(Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
    }

    private boolean isOwner(Notification notification) {
        return currentUserService.isStudent()
                && notification.getStudent().getId().equals(currentUserService.getCurrentStudent().getId());
    }

    private void assertCanAccess(Notification notification) {
        if (isOwner(notification)) {
            return;
        }
        if (currentUserService.isAdmin()) {
            Long mine = currentUserService.getCurrentInstitution().getId();
            var studentInstitution = notification.getStudent().getInstitution();
            if (studentInstitution != null && studentInstitution.getId().equals(mine)) {
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this notification");
    }
}
