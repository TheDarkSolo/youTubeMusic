package com.ytmusicmerger.backend.dedupe;

import java.util.List;

/**
 * §5.11 request body. {@code excludedExactVideoIds} is an amendment on top of the original
 * doc, mirroring the same field on {@code MergeExecuteRequest}: videoIds from the preview's
 * {@code removals.exact} that the user unchecked (kept, not removed).
 */
public record DedupeExecuteRequest(String planToken, List<String> confirmedPossibleDuplicateGroupIds,
                                    List<String> excludedExactVideoIds) {
}
