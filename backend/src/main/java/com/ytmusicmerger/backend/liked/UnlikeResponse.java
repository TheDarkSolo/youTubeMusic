package com.ytmusicmerger.backend.liked;

import com.ytmusicmerger.backend.plan.ExecuteErrorDto;

import java.util.List;

/**
 * §5.16 {@code POST /api/liked/unlike} response. {@code status} follows the same three-value
 * convention as merge/dedupe/like-all execute responses (§5.15): {@code "completed"},
 * {@code "partial"} (non-empty {@code errors}), or {@code "quota_exhausted"}. {@code remaining}
 * is always present ({@code 0} on non-quota outcomes).
 */
public record UnlikeResponse(String status, long unliked, long remaining, List<ExecuteErrorDto> errors) {
}
