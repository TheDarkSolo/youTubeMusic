package com.ytmusicmerger.backend.error;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * §5.7 translation from a {@link GoogleJsonResponseException} to an {@link ApiException}.
 * Shared by {@code GlobalExceptionHandler} (for any Google exception that propagates
 * uncaught) and call sites that catch {@code IOException} directly and need to translate
 * it before wrapping - without this, a blanket {@code catch (IOException e)} around a
 * YouTube API call silently swallows the real 401/403/429 into a generic 500, which is
 * exactly what happened in practice (merge preview surfaced "Failed to fetch playlist
 * metadata" instead of the actual quota-exceeded error underneath).
 */
public final class GoogleApiErrorTranslator {

    private static final Logger log = LoggerFactory.getLogger(GoogleApiErrorTranslator.class);

    private GoogleApiErrorTranslator() {
    }

    public static ApiException translate(GoogleJsonResponseException ex) {
        String reason = extractReason(ex);
        int status = ex.getStatusCode();

        if (status == 401) {
            return ApiException.unauthenticated("No active YouTube session. Please log in again.");
        }
        if (status == 403 && reason != null && reason.toLowerCase().contains("quota")) {
            return ApiException.quotaExceeded(
                    "YouTube API daily quota exceeded. Try again after quota reset (midnight Pacific time).");
        }
        if (status == 429) {
            return ApiException.quotaExceeded(
                    "YouTube API daily quota exceeded. Try again after quota reset (midnight Pacific time).");
        }
        if (status == 403) {
            return ApiException.forbidden("You do not have permission to modify this playlist.");
        }
        if (status == 404) {
            return ApiException.notFound("The requested YouTube resource was not found.");
        }
        log.error("Unhandled GoogleJsonResponseException (status={}, reason={}): {}", status, reason,
                ex.getMessage(), ex);
        return new ApiException(ErrorCode.INTERNAL_ERROR, "YouTube API request failed unexpectedly.");
    }

    /**
     * §5.15 quota-exhaustion stop rule: true when a failed write call means the day's YouTube
     * API quota is gone and every remaining call in the loop is doomed. Uses exactly the same
     * signals {@link #translate} maps to {@link ErrorCode#QUOTA_EXCEEDED} (HTTP 403 with a
     * quota-related reason, or HTTP 429), so the two can never drift apart. Also recognises an
     * already-translated {@link ApiException} and unwraps wrapped causes, since call sites catch
     * a broad {@code Exception} around the YouTube client.
     */
    public static boolean isQuotaExhausted(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof ApiException apiEx && apiEx.code() == ErrorCode.QUOTA_EXCEEDED) {
                return true;
            }
            if (t instanceof GoogleJsonResponseException gje) {
                int status = gje.getStatusCode();
                if (status == 429) {
                    return true;
                }
                String reason = extractReason(gje);
                if (status == 403 && reason != null && reason.toLowerCase().contains("quota")) {
                    return true;
                }
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return false;
    }

    private static String extractReason(GoogleJsonResponseException ex) {
        try {
            if (ex.getDetails() != null && ex.getDetails().getErrors() != null
                    && !ex.getDetails().getErrors().isEmpty()) {
                return ex.getDetails().getErrors().get(0).getReason();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }
}
