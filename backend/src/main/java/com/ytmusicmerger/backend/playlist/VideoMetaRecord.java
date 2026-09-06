package com.ytmusicmerger.backend.playlist;

/**
 * §5.16 step 2 result: one video's {@code snippet.categoryId}/{@code title}/{@code channelTitle}
 * as resolved by a batched {@code videos.list} call. Used by the Liked Music Audit to classify
 * the account's "Liked videos" list by category.
 */
public record VideoMetaRecord(String videoId, String title, String channelTitle, String categoryId) {
}
