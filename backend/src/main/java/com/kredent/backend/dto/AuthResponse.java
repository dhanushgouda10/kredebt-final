package com.kredent.backend.dto;

public class AuthResponse {

    private String token;
    private String role;
    private Long id;
    private String fullName;
    private String email;
    /** Set for college-administrator sessions only; null for students. */
    private InstitutionSummary institution;

    public AuthResponse(String token, String role, Long id, String fullName, String email) {
        this.token = token;
        this.role = role;
        this.id = id;
        this.fullName = fullName;
        this.email = email;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public InstitutionSummary getInstitution() {
        return institution;
    }

    public void setInstitution(InstitutionSummary institution) {
        this.institution = institution;
    }
}
