package com.ytmusicmerger.backend.playlist;

/** §5.13 response. {@code totalTracks} is the raw playlist item count; {@code alreadyLiked} and
 * {@code toLike} are computed over the playlist's unique {@code videoId}s (a playlist can
 * contain the same video more than once, but it only needs to be rated once). */
public record LikePreviewResponse(String playlistId, long totalTracks, long alreadyLiked, long toLike,
                                   LikeQuotaDto estimatedQuota) {
}
