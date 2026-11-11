package com.kredent.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Application error with a stable machine-readable {@code code} the frontend can branch on
 * (for example INSTITUTION_NOT_FOUND vs INSTITUTION_PENDING) without parsing English messages.
 * {@code retryAfterSeconds} is set for cooldown / lockout responses.
 *
 * Messages must never contain OTPs, hashes, passwords or credentials.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Integer retryAfterSeconds;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, Integer retryAfterSeconds) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Integer getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
