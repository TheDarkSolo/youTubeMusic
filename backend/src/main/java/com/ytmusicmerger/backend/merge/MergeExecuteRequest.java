package com.ytmusicmerger.backend.merge;

import java.util.List;

/**
 * §5.9 request body. {@code excludedExactVideoIds} is an amendment on top of the original
 * doc: videoIds from the preview's {@code plannedRemovals.exact} that the user unchecked
 * (i.e. wants kept). Omit/empty means "remove all exact duplicates as planned".
 */
public record MergeExecuteRequest(String planToken, List<String> confirmedPossibleDuplicateGroupIds,
                                   List<String> excludedExactVideoIds) {
}
