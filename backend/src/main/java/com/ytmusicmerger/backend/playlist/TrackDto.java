package com.ytmusicmerger.backend.playlist;

/** §5.6 track entry - shape returned to the frontend for a single playlist's tracks. */
public record TrackDto(String playlistItemId, String videoId, String title,
                        String channelTitle, String channelId, String thumbnailUrl) {
}
