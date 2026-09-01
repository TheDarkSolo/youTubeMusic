package com.ytmusicmerger.backend.error;

import com.google.api.client.googleapis.json.GoogleJsonError;
import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.http.HttpHeaders;
import com.google.api.client.http.HttpResponseException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * §5.15 quota-exhaustion detection. Pure predicate, no YouTube client involved: the exceptions
 * are constructed directly so the test never touches the network or the user's quota.
 */
class GoogleApiErrorTranslatorTest {

    private static GoogleJsonResponseException googleError(int statusCode, String reason) {
        GoogleJsonError details = new GoogleJsonError();
        details.setCode(statusCode);
        if (reason != null) {
            GoogleJsonError.ErrorInfo info = new GoogleJsonError.ErrorInfo();
            info.setReason(reason);
            details.setErrors(List.of(info));
        }
        HttpResponseException.Builder builder =
                new HttpResponseException.Builder(statusCode, "error", new HttpHeaders());
        return new GoogleJsonResponseException(builder, details);
    }

    @Test
    void detects403WithQuotaReason() {
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(googleError(403, "quotaExceeded")));
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(googleError(403, "dailyLimitExceeded_quota")));
    }

    @Test
    void detects429RateLimit() {
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(googleError(429, "rateLimitExceeded")));
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(googleError(429, null)));
    }

    @Test
    void ignoresNonQuotaFailures() {
        // A per-item permission/not-found problem must keep flowing into `errors` and must not
        // abort the rest of the write loop.
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(googleError(403, "forbidden")));
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(googleError(404, "videoNotFound")));
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(googleError(401, "authError")));
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(new IOException("connection reset")));
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(null));
    }

    @Test
    void detectsAlreadyTranslatedAndWrappedQuotaErrors() {
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(ApiException.quotaExceeded("quota gone")));
        assertFalse(GoogleApiErrorTranslator.isQuotaExhausted(ApiException.forbidden("nope")));
        assertTrue(GoogleApiErrorTranslator.isQuotaExhausted(
                new RuntimeException("wrapped", googleError(403, "quotaExceeded"))));
    }

    @Test
    void agreesWithTranslateForQuotaCases() {
        // The stop rule and the §5.7 error mapping must never drift apart.
        for (GoogleJsonResponseException ex : List.of(googleError(403, "quotaExceeded"), googleError(429, null),
                googleError(403, "forbidden"), googleError(404, "videoNotFound"))) {
            boolean translatedAsQuota = GoogleApiErrorTranslator.translate(ex).code() == ErrorCode.QUOTA_EXCEEDED;
            assertTrue(translatedAsQuota == GoogleApiErrorTranslator.isQuotaExhausted(ex),
                    "detection disagreed with translate() for status " + ex.getStatusCode());
        }
    }
}
