package com.kredent.backend.dto;

public record InstitutionOtpVerifyResponse(boolean verified, InstitutionSummary institution) {
}
