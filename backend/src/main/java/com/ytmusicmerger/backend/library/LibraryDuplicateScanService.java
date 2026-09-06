package com.ytmusicmerger.backend.library;

import com.ytmusicmerger.backend.plan.RemovalPlanBuilder;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.PlaylistMeta;
import com.ytmusicmerger.backend.playlist.PlaylistService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * §5.17 - Library-wide Duplicate Scan. Deliberately not a new duplicate-detection concept:
 * for every owned playlist with at least 2 items, this runs the exact same
 * {@link RemovalPlanBuilder} (backed by {@code DuplicateTrackDetector}) that
 * {@code DedupePlanService}/{@code /api/dedupe/preview} already uses, purely to surface counts.
 * No execute path lives here - acting on a result means following the existing
 * {@code /api/dedupe/preview} -> review -> confirm flow for that {@code playlistId}.
 */
@Service
public class LibraryDuplicateScanService {

    private final PlaylistService playlistService;
    private final RemovalPlanBuilder removalPlanBuilder;

    public LibraryDuplicateScanService(PlaylistService playlistService, RemovalPlanBuilder removalPlanBuilder) {
        this.playlistService = playlistService;
        this.removalPlanBuilder = removalPlanBuilder;
    }

    public DuplicateScanResponse scan() {
        List<PlaylistMeta> playlists = playlistService.fetchOwnPlaylistMeta();

        List<PlaylistDuplicateScanDto> result = new ArrayList<>();
        for (PlaylistMeta meta : playlists) {
            if (meta.itemCount() < 2) {
                continue;
            }
            List<PlaylistItemRecord> items = playlistService.fetchAllTracks(meta.id());
            RemovalPlanBuilder.RemovalPlan plan = removalPlanBuilder.build(items, null);

            // Same computation as DedupePlanService.preview's summary.exactDuplicatesToRemove.
            int exactDuplicateTracks = plan.exact().stream().mapToInt(g -> g.remove().size()).sum();
            int possibleDuplicateGroups = plan.possible().size();

            if (exactDuplicateTracks > 0 || possibleDuplicateGroups > 0) {
                result.add(new PlaylistDuplicateScanDto(meta.id(), meta.title(), meta.itemCount(),
                        exactDuplicateTracks, possibleDuplicateGroups));
            }
        }
        return new DuplicateScanResponse(result);
    }
}
