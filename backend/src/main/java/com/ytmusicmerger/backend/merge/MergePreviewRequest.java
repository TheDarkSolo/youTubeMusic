package com.ytmusicmerger.backend.merge;

import java.util.List;

/** §5.8 request body. */
public record MergePreviewRequest(List<String> sourcePlaylistIds, MergeTargetRequest target) {
}
