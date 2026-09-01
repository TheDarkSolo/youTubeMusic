package com.ytmusicmerger.backend.playlist;

/** §5.12 response. */
public record DeletePlaylistResponse(boolean deleted, String playlistId) {
}
