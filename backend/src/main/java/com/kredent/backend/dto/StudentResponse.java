package com.kredent.backend.dto;

import com.kredent.backend.entity.Student;

import java.time.LocalDateTime;

/**
 * Never return the Student entity directly — it (correctly) still carries the password hash
 * field, AND (Phase 3) the encrypted wallet private key. walletAddress (public, safe) is
 * included below; walletPrivateKeyEncrypted is deliberately never referenced anywhere in this
 * class.
 */
public class StudentResponse {

    private Long id;
    private String fullName;
    private String usn;
    private String email;
    private String phone;
    private String department;
    private LocalDateTime createdAt;
    private String walletAddress;

    /**
     * Whether the welcome email reached the provider. Only populated on creation
     * (see StudentService.adminCreateStudent) — null everywhere else, so list and
     * update responses are unchanged and the frontend simply shows no notice.
     */
    private Boolean emailSent;

    public static StudentResponse from(Student student) {
        StudentResponse dto = new StudentResponse();
        dto.id = student.getId();
        dto.fullName = student.getFullName();
        dto.usn = student.getUsn();
        dto.email = student.getEmail();
        dto.phone = student.getPhone();
        dto.department = student.getDepartment();
        dto.createdAt = student.getCreatedAt();
        dto.walletAddress = student.getWalletAddress();
        return dto;
    }

    /** Creation variant — carries whether the welcome notification was delivered. */
    public static StudentResponse from(Student student, boolean emailSent) {
        StudentResponse dto = from(student);
        dto.emailSent = emailSent;
        return dto;
    }

    public Boolean getEmailSent() {
        return emailSent;
    }

    public void setEmailSent(Boolean emailSent) {
        this.emailSent = emailSent;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getUsn() {
        return usn;
    }

    public void setUsn(String usn) {
        this.usn = usn;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }
}
