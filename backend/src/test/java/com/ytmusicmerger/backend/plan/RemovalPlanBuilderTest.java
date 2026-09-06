package com.ytmusicmerger.backend.plan;

import com.ytmusicmerger.backend.detect.DuplicateTrackDetector;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * {@link RemovalPlanBuilder.RemovalPlan#exactDuplicateCount()} is the single formula behind
 * both {@code DedupePlanService}/{@code MergePlanService}'s preview summaries and
 * {@code LibraryDuplicateScanService}'s per-playlist scan count. This pins its behavior
 * directly, so the three callers can never quietly disagree on the same playlist's duplicate
 * count by one of them drifting to a different inline calculation.
 */
class RemovalPlanBuilderTest {

    private final RemovalPlanBuilder builder = new RemovalPlanBuilder(new DuplicateTrackDetector());

    private static PlaylistItemRecord item(String playlistId, String itemId, String videoId, String title) {
        return new PlaylistItemRecord(playlistId, itemId, videoId, title, "Some Artist", "UC1", null);
    }

    @Test
    void exactDuplicateCountIsZeroWithNoDuplicates() {
        List<PlaylistItemRecord> items = List.of(
                item("PL1", "i1", "v1", "Song A"),
                item("PL1", "i2", "v2", "Song B"));

        RemovalPlanBuilder.RemovalPlan plan = builder.build(items, null);

        assertEquals(0, plan.exactDuplicateCount());
    }

    @Test
    void exactDuplicateCountMatchesTotalRemovalsAcrossGroups() {
        // v1 appears 3 times (2 removals) and v2 appears 2 times (1 removal) -> 3 total.
        List<PlaylistItemRecord> items = List.of(
                item("PL1", "i1", "v1", "Song A"),
                item("PL1", "i2", "v1", "Song A"),
                item("PL1", "i3", "v1", "Song A"),
                item("PL1", "i4", "v2", "Song B"),
                item("PL1", "i5", "v2", "Song B"),
                item("PL1", "i6", "v3", "Song C"));

        RemovalPlanBuilder.RemovalPlan plan = builder.build(items, null);

        int expected = plan.exact().stream().mapToInt(g -> g.remove().size()).sum();
        assertEquals(expected, plan.exactDuplicateCount());
        assertEquals(3, plan.exactDuplicateCount());
    }
}
