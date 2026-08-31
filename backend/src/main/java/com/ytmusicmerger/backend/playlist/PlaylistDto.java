package com.ytmusicmerger.backend.playlist;

/** §5.5 playlist entry. */
public record PlaylistDto(String id, String title, long itemCount, String thumbnailUrl, String duplicateGroupId) {
}
