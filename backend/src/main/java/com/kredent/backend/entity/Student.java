package com.kredent.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

@Entity
@Table(name = "students", uniqueConstraints = {
        // A USN is unique within one institution, not across the whole platform.
        @UniqueConstraint(name = "uk_students_institution_usn", columnNames = {"institution_id", "usn"})
})
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String usn;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String department;

    // The institution this student belongs to. Nullable only for rows created before
    // multi-institution support (see institution.adopt-legacy-data-for).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "institution_id")
    private Institution institution;

    // TODO: Replace plain-text storage with BCrypt hashing (PasswordEncoder) before production.
    @Column(nullable = false)
    @JsonIgnore
    private String password;

    // System-managed wallet (Phase 3, "Option B"). Generated once, automatically, the moment
    // this row is first created — see WalletService + AuthService.register /
    // StudentService.adminCreateStudent. Public address, safe to return in API responses.
    @Column(name = "wallet_address", unique = true)
    private String walletAddress;

    // AES-256-GCM encrypted (see WalletService), Base64-encoded. This is the ONLY place the
    // student's private key exists outside the moment it was generated. @JsonIgnore is a
    // second layer of defense — no StudentResponse field ever reads this getter anyway, so it
    // can never leave the backend via an API response even if a DTO mapping mistake happened.
    @Column(name = "wallet_private_key_encrypted", length = 1024)
    @JsonIgnore
    private String walletPrivateKeyEncrypted;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Institution getInstitution() {
        return institution;
    }

    public void setInstitution(Institution institution) {
        this.institution = institution;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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

    public String getWalletPrivateKeyEncrypted() {
        return walletPrivateKeyEncrypted;
    }

    public void setWalletPrivateKeyEncrypted(String walletPrivateKeyEncrypted) {
        this.walletPrivateKeyEncrypted = walletPrivateKeyEncrypted;
    }
}
