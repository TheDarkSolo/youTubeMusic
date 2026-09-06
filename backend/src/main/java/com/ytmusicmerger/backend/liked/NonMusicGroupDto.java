package com.ytmusicmerger.backend.liked;

import java.util.List;

/** §5.16 - one non-music category grouping in the audit response. */
public record NonMusicGroupDto(String categoryId, String categoryName, List<LikedItemDto> items) {
}
