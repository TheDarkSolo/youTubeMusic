package com.ytmusicmerger.backend.plan;

import java.util.List;

/** §5.8 {@code plannedRemovals.exact} / §5.10 {@code removals.exact} entry. Pre-selected. */
public record ExactRemovalGroupDto(String videoId, String title, PlaylistItemRefDto keep,
                                    List<PlaylistItemRefDto> remove) {
}
