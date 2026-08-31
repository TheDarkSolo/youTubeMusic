package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.plan.ExactRemovalGroupDto;
import com.ytmusicmerger.backend.plan.PossibleDuplicateGroupDto;

import java.util.List;

/** §5.8 {@code plannedRemovals}. */
public record PlannedRemovalsDto(List<ExactRemovalGroupDto> exact, List<PossibleDuplicateGroupDto> possibleDuplicates) {
}
