package com.ytmusicmerger.backend.plan;

/** A single (playlistId, playlistItemId) reference, as used in exact-removal groups. */
public record PlaylistItemRefDto(String playlistId, String playlistItemId) {
}
