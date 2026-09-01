package com.ytmusicmerger.backend.playlist;

/**
 * §5.13 {@code estimatedQuota} for {@code like-preview}. Unlike {@code EstimatedQuotaDto}
 * (§5.8/§5.10, used by merge/dedupe), there is no possible-duplicate-style optional cost here
 * - every unliked track is definitely going to be rated if the user confirms - so this is a
 * single {@code committedUnits} field rather than force-fitting an unused {@code
 * maxAdditionalUnits}.
 */
public record LikeQuotaDto(long committedUnits) {
}
