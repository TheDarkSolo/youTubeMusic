package com.ytmusicmerger.backend.merge;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Response shape for the echoed {@code target}. {@code playlistId} is omitted entirely
 * (not just null) when {@code mode == "create"}, per §5.8's note that the id doesn't exist
 * yet at preview time.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MergeTargetResponseDto(String mode, String playlistId, String title) {
}
