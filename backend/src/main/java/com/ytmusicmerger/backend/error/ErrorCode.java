package com.ytmusicmerger.backend.error;

import org.springframework.http.HttpStatus;

/**
 * §5.7 error codes. Each code has one natural HTTP status and a fixed "retryable"
 * semantics ({@code true} = frontend may offer a plain retry, {@code false} = the user
 * must take a different action such as re-authenticating or re-running preview).
 */
public enum ErrorCode {

    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, false),
    FORBIDDEN(HttpStatus.FORBIDDEN, false),
    QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, true),
    PLAN_STALE(HttpStatus.CONFLICT, true),
    PLAN_NOT_FOUND(HttpStatus.NOT_FOUND, true),
    NOT_FOUND(HttpStatus.NOT_FOUND, false),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, false),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, true);

    private final HttpStatus httpStatus;
    private final boolean defaultRetryable;

    ErrorCode(HttpStatus httpStatus, boolean defaultRetryable) {
        this.httpStatus = httpStatus;
        this.defaultRetryable = defaultRetryable;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    public boolean defaultRetryable() {
        return defaultRetryable;
    }
}
