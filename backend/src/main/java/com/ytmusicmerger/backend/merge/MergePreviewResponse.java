package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.plan.EstimatedQuotaDto;

import java.time.Instant;
import java.util.List;

/** §5.8 response body. */
public record MergePreviewResponse(String planToken, Instant expiresAt, MergeTargetResponseDto target,
                                    List<SourcePlaylistDto> sourcePlaylists, List<PlannedAddDto> plannedAdds,
                                    PlannedRemovalsDto plannedRemovals, MergeSummaryDto summary,
                                    EstimatedQuotaDto estimatedQuota) {
}
