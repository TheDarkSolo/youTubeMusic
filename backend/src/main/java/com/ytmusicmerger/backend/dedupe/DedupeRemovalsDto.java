package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.plan.ExactRemovalGroupDto;
import com.ytmusicmerger.backend.plan.PossibleDuplicateGroupDto;

import java.util.List;

/** §5.10 {@code removals}. */
public record DedupeRemovalsDto(List<ExactRemovalGroupDto> exact, List<PossibleDuplicateGroupDto> possibleDuplicates) {
}
