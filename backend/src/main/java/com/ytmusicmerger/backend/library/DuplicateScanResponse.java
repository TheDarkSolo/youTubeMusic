package com.ytmusicmerger.backend.library;

import java.util.List;

/** §5.17 response. */
public record DuplicateScanResponse(List<PlaylistDuplicateScanDto> playlists) {
}
