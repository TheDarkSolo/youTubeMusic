package com.ytmusicmerger.backend.plan;

import java.util.List;

/**
 * §5.8/§5.10 {@code possibleDuplicates} group. Never pre-selected - removal requires the
 * user to explicitly confirm this {@code groupId} in the execute request.
 */
public record PossibleDuplicateGroupDto(String groupId, double similarity, List<PossibleDupItemDto> items) {
}
