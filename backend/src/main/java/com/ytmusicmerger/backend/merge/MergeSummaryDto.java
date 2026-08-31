package com.ytmusicmerger.backend.merge;

/** §5.8 {@code summary}. */
public record MergeSummaryDto(int toAdd, int exactDuplicatesToRemove, int possibleDuplicateGroups) {
}
