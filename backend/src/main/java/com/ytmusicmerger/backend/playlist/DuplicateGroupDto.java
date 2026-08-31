package com.ytmusicmerger.backend.playlist;

import java.util.List;

/** §5.5 duplicate-group entry. */
public record DuplicateGroupDto(String id, List<String> playlistIds, double confidence, String matchType) {
}
