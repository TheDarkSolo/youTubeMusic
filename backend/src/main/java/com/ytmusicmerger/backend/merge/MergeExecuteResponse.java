package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/**
 * §5.9 response body.
 *
 * <p>{@code status} is {@code "completed"}, {@code "partial"} or - per §5.15 - {@code
 * "quota_exhausted"}. {@code remaining} is the §5.15 count of planned write operations
 * (adds + exact removals + confirmed possible removals) left unattempted when the run
 * stopped; always present, {@code 0} on non-quota outcomes.
 */
public record MergeExecuteResponse(String status, TargetRefDto target, int added, int removedExact,
                                    int removedConfirmedPossible, List<String> sourcePlaylistsDeleted,
                                    int remaining, List<ExecuteErrorDto> errors) {
}
