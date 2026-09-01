package com.ytmusicmerger.backend.playlist;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/** §5.14 response. {@code status} is {@code "partial"} if {@code errors} is non-empty, same
 * convention as the merge/dedupe execute responses. */
public record LikeAllResponse(String status, long liked, long alreadyLiked, List<ExecuteErrorDto> errors) {
}
