package com.ytmusicmerger.backend.liked;

import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.VideoMetaRecord;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pure classification logic for §5.16: given the raw "Liked videos" (`LL`) playlist items, the
 * resolved {@link VideoMetaRecord} for each unique videoId, and the categoryId -> name map,
 * splits them into {@code musicCount} (categoryId "10") and {@code nonMusicGroups} (everything
 * else, grouped by categoryId). No YouTube API calls here - fully unit-testable.
 */
public final class LikedAuditClassifier {

    /** YouTube's well-known categoryId for "Music" (§5.16 step 4). */
    static final String MUSIC_CATEGORY_ID = "10";

    /** Used when a liked video's metadata couldn't be resolved (e.g. deleted/private video). */
    static final String UNKNOWN_CATEGORY_ID = "unknown";
    private static final String UNKNOWN_CATEGORY_NAME = "Unknown";

    private LikedAuditClassifier() {
    }

    public static LikedAuditResponse classify(List<PlaylistItemRecord> items,
                                               Map<String, VideoMetaRecord> metaByVideoId,
                                               Map<String, String> categoryNames) {
        long musicCount = 0;
        long totalCounted = 0;
        Map<String, List<LikedItemDto>> groupedByCategory = new LinkedHashMap<>();

        // The raw "Liked videos" list is live and ordered by recency, so paginating it while the
        // user (or this app's own like-script feature) is actively liking things can surface the
        // same videoId on two consecutive pages as the list shifts underneath the fetch. Count
        // each liked video once, not once per playlistItem row.
        Set<String> seenVideoIds = new LinkedHashSet<>();
        for (PlaylistItemRecord item : items) {
            String videoId = item.videoId();
            if (videoId != null && !seenVideoIds.add(videoId)) {
                continue; // already counted this video from an earlier row
            }
            totalCounted++;
            VideoMetaRecord meta = videoId != null ? metaByVideoId.get(videoId) : null;
            String categoryId = meta != null && meta.categoryId() != null ? meta.categoryId() : UNKNOWN_CATEGORY_ID;
            String title = meta != null ? meta.title() : item.title();
            String channelTitle = meta != null ? meta.channelTitle() : item.channelTitle();

            if (MUSIC_CATEGORY_ID.equals(categoryId)) {
                musicCount++;
                continue;
            }
            groupedByCategory.computeIfAbsent(categoryId, k -> new ArrayList<>())
                    .add(new LikedItemDto(videoId, title, channelTitle));
        }

        List<NonMusicGroupDto> nonMusicGroups = new ArrayList<>();
        for (Map.Entry<String, List<LikedItemDto>> entry : groupedByCategory.entrySet()) {
            String categoryId = entry.getKey();
            String categoryName = UNKNOWN_CATEGORY_ID.equals(categoryId)
                    ? UNKNOWN_CATEGORY_NAME
                    : categoryNames.getOrDefault(categoryId, UNKNOWN_CATEGORY_NAME);
            nonMusicGroups.add(new NonMusicGroupDto(categoryId, categoryName, entry.getValue()));
        }

        return new LikedAuditResponse(totalCounted, musicCount, nonMusicGroups);
    }
}
