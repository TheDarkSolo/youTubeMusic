package com.ytmusicmerger.backend.liked;

import java.util.List;

/**
 * §5.16 {@code GET /api/liked/audit} response. No {@code estimatedQuota} field - this call is
 * pure read (1-unit list calls only); the frontend computes the write cost of whatever the
 * user selects to unlike locally, same live-recompute pattern as merge/dedupe review screens.
 */
public record LikedAuditResponse(long totalLiked, long musicCount, List<NonMusicGroupDto> nonMusicGroups) {
}
