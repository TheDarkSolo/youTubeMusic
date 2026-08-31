package com.ytmusicmerger.backend.playlist;

import java.util.List;

/** §5.5 response. */
public record PlaylistsResponse(List<PlaylistDto> playlists, List<DuplicateGroupDto> duplicateGroups) {
}
