package com.ytmusicmerger.backend.plan;

/**
 * §5.8/§5.10 {@code estimatedQuota}: purely informational YouTube Data API v3 quota estimate
 * for a preview's plan, computed from published per-call costs ({@code playlistItems.insert}/
 * {@code delete} = 50 units each, {@code playlists.insert} = 50 units; list calls = 1 unit and
 * are ignored as negligible).
 *
 * <p>{@code committedUnits} is the cost of what's already selected by default (planned adds +
 * pre-selected exact-duplicate removals, plus playlist creation if applicable).
 * {@code maxAdditionalUnits} is the extra cost if the user confirms every {@code
 * possibleDuplicates} group. Shared between {@code MergePlanService} and {@code
 * DedupePlanService} since both compute it identically - see each for the exact formula.
 *
 * <p>This never gates or blocks execute; it exists only so the frontend can warn the user
 * before they spend quota.
 */
public record EstimatedQuotaDto(long committedUnits, long maxAdditionalUnits) {
}
