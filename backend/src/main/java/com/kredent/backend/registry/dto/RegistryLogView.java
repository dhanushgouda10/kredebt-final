package com.kredent.backend.registry.dto;

import java.time.Instant;

public record RegistryLogView(long id, String institutionId, String event, String detail, Instant createdAt) {
}
