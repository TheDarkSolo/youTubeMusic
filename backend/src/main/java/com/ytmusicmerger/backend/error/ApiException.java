package com.ytmusicmerger.backend.error;

/** Uniform application exception carrying a §5.7 error code / message / retryable flag. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final boolean retryable;

    public ApiException(ErrorCode code, String message) {
        this(code, message, code.defaultRetryable());
    }

    public ApiException(ErrorCode code, String message, boolean retryable) {
        super(message);
        this.code = code;
        this.retryable = retryable;
    }

    public ErrorCode code() {
        return code;
    }

    public boolean retryable() {
        return retryable;
    }

    public static ApiException unauthenticated(String message) {
        return new ApiException(ErrorCode.UNAUTHENTICATED, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message);
    }

    public static ApiException quotaExceeded(String message) {
        return new ApiException(ErrorCode.QUOTA_EXCEEDED, message);
    }

    public static ApiException planStale(String message) {
        return new ApiException(ErrorCode.PLAN_STALE, message);
    }

    public static ApiException planNotFound(String message) {
        return new ApiException(ErrorCode.PLAN_NOT_FOUND, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message);
    }

    public static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, message);
    }
}
