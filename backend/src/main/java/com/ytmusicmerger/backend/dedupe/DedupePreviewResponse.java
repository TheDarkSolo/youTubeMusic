package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.plan.EstimatedQuotaDto;

import java.time.Instant;

/** §5.10 response body. */
public record DedupePreviewResponse(String planToken, Instant expiresAt, String playlistId,
                                     DedupeRemovalsDto removals, DedupeSummaryDto summary,
                                     EstimatedQuotaDto estimatedQuota) {
}
