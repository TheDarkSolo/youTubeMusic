package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/** §5.11 response body. */
public record DedupeExecuteResponse(String status, String playlistId, int removedExact,
                                     int removedConfirmedPossible, List<ExecuteErrorDto> errors) {
}
