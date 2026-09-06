package com.ytmusicmerger.backend.liked;

import com.ytmusicmerger.backend.error.GoogleApiErrorTranslator;
import com.ytmusicmerger.backend.plan.ExecuteErrorDto;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.PlaylistService;
import com.ytmusicmerger.backend.playlist.VideoMetaRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * §5.16 Liked Music Audit. Composes {@link PlaylistService} (which owns all raw
 * playlistItems/videos/videoCategories API access) same as {@code DedupePlanService} does for
 * §5.10/§5.11 - this class holds only the audit-specific business logic (classification via
 * {@link LikedAuditClassifier}, and the §5.15 quota-exhaustion write loop for unlike).
 */
@Service
public class LikedAuditService {

    private static final Logger log = LoggerFactory.getLogger(LikedAuditService.class);

    /** YouTube's well-known literal playlist id for the authenticated user's "Liked videos" list. */
    private static final String LIKED_PLAYLIST_ID = "LL";

    private final PlaylistService playlistService;

    public LikedAuditService(PlaylistService playlistService) {
        this.playlistService = playlistService;
    }

    /** §5.16 - read-only. */
    public LikedAuditResponse audit() {
        List<PlaylistItemRecord> items = playlistService.fetchAllTracks(LIKED_PLAYLIST_ID);
        List<String> uniqueVideoIds = uniqueVideoIds(items);
        List<VideoMetaRecord> metas = playlistService.fetchVideoMeta(uniqueVideoIds);
        Map<String, VideoMetaRecord> metaByVideoId = metas.stream()
                .collect(Collectors.toMap(VideoMetaRecord::videoId, m -> m, (a, b) -> a));
        Map<String, String> categoryNames = playlistService.fetchVideoCategoryNames();

        return LikedAuditClassifier.classify(items, metaByVideoId, categoryNames);
    }

    /**
     * §5.16 - unlikes each requested videoId. No plan-token/staleness machinery (§5.16 explicitly
     * calls this out: unliking is reversible, and the checkbox selection is the confirmation).
     * Follows §5.15's quota-exhaustion stop rule exactly, same pattern as
     * {@code PlaylistService.likeAll} / {@code DedupePlanService.execute}.
     */
    public UnlikeResponse unlike(UnlikeRequest request) {
        List<String> videoIds = request.videoIds() == null ? List.of() : request.videoIds();
        List<ExecuteErrorDto> errors = new ArrayList<>();

        int totalPlanned = videoIds.size();
        int attempted = 0;
        boolean quotaExhausted = false;
        int unliked = 0;

        for (String videoId : videoIds) {
            attempted++;
            try {
                playlistService.unlikeVideo(videoId);
                unliked++;
            } catch (Exception e) {
                // §5.15: once the daily quota is gone every further rate call is doomed - stop
                // instead of firing further doomed calls, and report the stop via status +
                // `remaining` rather than flooding `errors`.
                if (GoogleApiErrorTranslator.isQuotaExhausted(e)) {
                    // This item was attempted but never landed, so it still counts as left to do.
                    attempted--;
                    quotaExhausted = true;
                    break;
                }
                errors.add(new ExecuteErrorDto("Failed to unlike video: " + e.getMessage(), videoId, LIKED_PLAYLIST_ID));
            }
        }

        long remaining = quotaExhausted ? Math.max(0, totalPlanned - attempted) : 0;
        if (quotaExhausted) {
            log.warn("Unlike stopped early on YouTube quota exhaustion after {} unlikes: {} videos left unattempted.",
                    unliked, remaining);
        }
        // §5.15 precedence: quota exhaustion outranks per-item errors, which are still reported.
        String status = quotaExhausted ? "quota_exhausted" : (errors.isEmpty() ? "completed" : "partial");
        return new UnlikeResponse(status, unliked, remaining, errors);
    }

    private List<String> uniqueVideoIds(List<PlaylistItemRecord> items) {
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (PlaylistItemRecord item : items) {
            if (item.videoId() != null) {
                ids.add(item.videoId());
            }
        }
        return new ArrayList<>(ids);
    }
}
