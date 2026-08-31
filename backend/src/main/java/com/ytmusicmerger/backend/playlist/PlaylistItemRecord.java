package com.ytmusicmerger.backend.playlist;

/**
 * Internal representation of one playlistItem, tagged with its owning playlist. Used by
 * {@code PlaylistService} to feed the pure detectors and by the merge/dedupe plan services
 * to build add/remove operations (which playlist an item lives in matters there, unlike in
 * the public §5.6 {@link TrackDto} shape).
 */
public record PlaylistItemRecord(String playlistId, String playlistItemId, String videoId, String title,
                                  String channelTitle, String channelId, String thumbnailUrl) {

    public TrackDto toTrackDto() {
        return new TrackDto(playlistItemId, videoId, title, channelTitle, channelId, thumbnailUrl);
    }
}
