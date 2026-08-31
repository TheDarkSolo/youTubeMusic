package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/** §5.9 response body. */
public record MergeExecuteResponse(String status, TargetRefDto target, int added, int removedExact,
                                    int removedConfirmedPossible, List<String> sourcePlaylistsDeleted,
                                    List<ExecuteErrorDto> errors) {
}
