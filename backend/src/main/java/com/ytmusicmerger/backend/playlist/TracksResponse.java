package com.ytmusicmerger.backend.playlist;

import java.util.List;

/** §5.6 response. */
public record TracksResponse(String playlistId, List<TrackDto> items, String nextPageToken) {
}
