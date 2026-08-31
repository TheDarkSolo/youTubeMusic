package com.ytmusicmerger.backend.error;

/** §5.7 error envelope: {@code { "error": { "code", "message", "retryable" } } }. */
public record ErrorResponse(ErrorBody error) {

    public record ErrorBody(String code, String message, boolean retryable) {
    }

    public static ErrorResponse of(ErrorCode code, String message, boolean retryable) {
        return new ErrorResponse(new ErrorBody(code.name(), message, retryable));
    }
}
