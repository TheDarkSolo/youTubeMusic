package com.ytmusicmerger.backend.liked;

/** §5.16 - one liked-videos-list item as surfaced in a {@link NonMusicGroupDto}. */
public record LikedItemDto(String videoId, String title, String channelTitle) {
}
