package com.kredent.backend.dto;

import com.kredent.backend.validation.MvjceEmail;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class RegisterRequest {

    @NotBlank
    private String fullName;

    @NotBlank
    private String usn;

    // Shared by both registration paths (public self-registration and admin-created
    // accounts), so this one constraint covers both.
    @NotBlank
    @Email
    @MvjceEmail
    private String email;

    @NotBlank
    private String phone;

    @NotBlank
    private String department;

    @NotBlank
    private String password;

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
}
