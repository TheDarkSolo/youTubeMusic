package com.ytmusicmerger.backend.error;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * §5.7 uniform error handling. Produces the exact error envelope for every endpoint, and
 * translates Google API exceptions (quota exceeded -> 429, insufficient permission -> 403,
 * invalid/expired session -> 401) into that same shape.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex) {
        if (ex.code() == ErrorCode.INTERNAL_ERROR) {
            log.error("Internal error: {}", ex.getMessage(), ex);
        }
        return ResponseEntity.status(ex.code().httpStatus())
                .body(ErrorResponse.of(ex.code(), ex.getMessage(), ex.retryable()));
    }

    @ExceptionHandler(GoogleJsonResponseException.class)
    public ResponseEntity<ErrorResponse> handleGoogleJsonResponseException(GoogleJsonResponseException ex) {
        ApiException translated = GoogleApiErrorTranslator.translate(ex);
        return ResponseEntity.status(translated.code().httpStatus())
                .body(ErrorResponse.of(translated.code(), translated.getMessage(), translated.retryable()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, IllegalArgumentException.class})
    public ResponseEntity<ErrorResponse> handleValidation(Exception ex) {
        return ResponseEntity.status(ErrorCode.VALIDATION_ERROR.httpStatus())
                .body(ErrorResponse.of(ErrorCode.VALIDATION_ERROR, ex.getMessage(), false));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR, "An unexpected error occurred.", true));
    }
}
