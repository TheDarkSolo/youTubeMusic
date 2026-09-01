package com.ytmusicmerger.backend.playlist;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/**
 * §5.14 response. {@code status} is {@code "partial"} if {@code errors} is non-empty, or - per
 * §5.15 - {@code "quota_exhausted"} if the write loop stopped on a quota error, same convention
 * as the merge/dedupe execute responses. {@code remaining} is the §5.15 count of unliked tracks
 * left unattempted when the loop stopped; always present, {@code 0} on non-quota outcomes.
 */
public record LikeAllResponse(String status, long liked, long alreadyLiked, long remaining,
                              List<ExecuteErrorDto> errors) {
}
