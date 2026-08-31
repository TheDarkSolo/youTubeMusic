package com.ytmusicmerger.backend.plan;

/** One item within a §5.8/§5.10 {@code possibleDuplicates} group. */
public record PossibleDupItemDto(String playlistId, String playlistItemId, String videoId, String title,
                                  String channelTitle) {
}
