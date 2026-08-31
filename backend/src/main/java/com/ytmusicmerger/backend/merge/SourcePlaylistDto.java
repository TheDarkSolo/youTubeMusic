package com.ytmusicmerger.backend.merge;

/** §5.8 {@code sourcePlaylists} entry. */
public record SourcePlaylistDto(String playlistId, String title, long itemCount) {
}
