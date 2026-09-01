package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/**
 * §5.11 response body.
 *
 * <p>{@code status} is {@code "completed"}, {@code "partial"} or - per §5.15 - {@code
 * "quota_exhausted"}. {@code remaining} is the §5.15 count of planned removals left
 * unattempted when the run stopped; always present, {@code 0} on non-quota outcomes.
 */
public record DedupeExecuteResponse(String status, String playlistId, int removedExact,
                                     int removedConfirmedPossible, int remaining,
                                     List<ExecuteErrorDto> errors) {
}
