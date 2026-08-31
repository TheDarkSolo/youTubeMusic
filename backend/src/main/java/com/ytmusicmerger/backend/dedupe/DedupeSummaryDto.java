package com.ytmusicmerger.backend.dedupe;

/** §5.10 {@code summary}. */
public record DedupeSummaryDto(int exactDuplicatesToRemove, int possibleDuplicateGroups) {
}
