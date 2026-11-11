package com.kredent.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;

/**
 * A college/university that has been verified on Kredent.
 *
 * The institutional registry (simulated, SQLite) stays the source of truth for the institution's
 * identity and approval status; this row is Kredent's own record of it. The two are tied together
 * by {@link #registryInstitutionId} — the registry's institutional ID — which is unique here, so an
 * institution can only ever be registered once. Name/state/district are a display snapshot so the
 * dashboard and certificates do not need a cross-database join; the HOI email is NOT copied (it is
 * always read from the registry at the moment an OTP is sent).
 *
 * The wallet lives on the institution rather than on a global admin so separate institutions can be
 * given separate wallets later. It is deliberately NOT unique: in the current demo several sample
 * colleges share the one existing MetaMask wallet (the one authorised on the smart contract).
 */
@Entity
@Table(name = "institutions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_institutions_registry_id", columnNames = "registry_institution_id")
})
public class Institution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "registry_institution_id", nullable = false, length = 40)
    private String registryInstitutionId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 80)
    private String state;

    @Column(nullable = false, length = 80)
    private String district;

    /** True once the HOI email OTP has been verified. */
    @Column(nullable = false)
    private boolean verified;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    /** Lower-case 0x address; null until the administrator connects MetaMask. */
    @Column(name = "wallet_address", length = 42)
    private String walletAddress;

    @Column(name = "wallet_linked_at")
    private LocalDateTime walletLinkedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /** Fully onboarded: HOI email verified AND an administrator wallet linked. */
    public boolean isOnboarded() {
        return verified && walletAddress != null && !walletAddress.isBlank();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRegistryInstitutionId() {
        return registryInstitutionId;
    }

    public void setRegistryInstitutionId(String registryInstitutionId) {
        this.registryInstitutionId = registryInstitutionId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public LocalDateTime getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(LocalDateTime verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress == null ? null : walletAddress.toLowerCase(java.util.Locale.ROOT);
    }

    public LocalDateTime getWalletLinkedAt() {
        return walletLinkedAt;
    }

    public void setWalletLinkedAt(LocalDateTime walletLinkedAt) {
        this.walletLinkedAt = walletLinkedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
