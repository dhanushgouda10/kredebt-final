package com.kredent.backend.registry.dto;

/** The institutional ID is deliberately absent: it is only handed out after the e-mail code is verified. */
public record RegistryRegisterResponse(String status, boolean emailSent, String email, String message) {
}
