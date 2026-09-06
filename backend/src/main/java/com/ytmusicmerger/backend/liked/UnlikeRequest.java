package com.ytmusicmerger.backend.liked;

import java.util.List;

/** §5.16 {@code POST /api/liked/unlike} request. */
public record UnlikeRequest(List<String> videoIds) {
}
