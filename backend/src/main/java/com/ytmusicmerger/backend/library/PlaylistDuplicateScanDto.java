package com.ytmusicmerger.backend.library;

/** §5.17 - one playlist's aggregate duplicate counts. */
public record PlaylistDuplicateScanDto(String playlistId, String title, long itemCount,
                                        int exactDuplicateTracks, int possibleDuplicateGroups) {
}
