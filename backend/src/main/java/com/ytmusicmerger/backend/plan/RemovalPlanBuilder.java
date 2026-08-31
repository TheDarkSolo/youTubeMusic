package com.ytmusicmerger.backend.plan;

import com.ytmusicmerger.backend.detect.DuplicateTrackDetector;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared §4-to-§5.8/§5.10 bridge: runs {@link DuplicateTrackDetector} over a set of items
 * and turns its grouping output into keep/remove plans - "which single item survives, which
 * others are candidates for {@code playlistItems.delete}". Used by both
 * {@code MergePlanService} (across the union of source playlists) and
 * {@code DedupePlanService} (within a single playlist), which is why this lives outside
 * either package.
 */
@Component
public class RemovalPlanBuilder {

    private final DuplicateTrackDetector detector;

    public RemovalPlanBuilder(DuplicateTrackDetector detector) {
        this.detector = detector;
    }

    public record ExactGroupPlan(String videoId, String title, PlaylistItemRecord keep,
                                  List<PlaylistItemRecord> remove) {
    }

    public record PossibleGroupPlan(String groupId, double similarity, List<PlaylistItemRecord> items) {
    }

    public record RemovalPlan(List<ExactGroupPlan> exact, List<PossibleGroupPlan> possible) {
    }

    /**
     * @param items               every candidate item (already the full union for a merge,
     *                            or a single playlist's items for standalone dedupe).
     * @param preferredKeepPlaylistId when an exact-duplicate group contains an item already
     *                            residing in this playlist (typically the merge target),
     *                            that item is kept and all others in the group are marked
     *                            for removal. May be {@code null} (dedupe has no such
     *                            preference - the first-encountered item is kept, matching
     *                            playlist position order).
     */
    public RemovalPlan build(List<PlaylistItemRecord> items, String preferredKeepPlaylistId) {
        List<DuplicateTrackDetector.TrackInput> inputs = new ArrayList<>();
        for (PlaylistItemRecord item : items) {
            inputs.add(new DuplicateTrackDetector.TrackInput(item.playlistId(), item.playlistItemId(),
                    item.videoId(), item.title(), item.channelId(), item.channelTitle()));
        }
        DuplicateTrackDetector.Result result = detector.detect(inputs);

        List<ExactGroupPlan> exactPlans = new ArrayList<>();
        for (DuplicateTrackDetector.ExactGroup group : result.exact()) {
            List<PlaylistItemRecord> members = toRecords(group.items(), items);
            PlaylistItemRecord keep = choosePreferred(members, preferredKeepPlaylistId);
            List<PlaylistItemRecord> remove = new ArrayList<>();
            for (PlaylistItemRecord m : members) {
                if (m != keep) {
                    remove.add(m);
                }
            }
            exactPlans.add(new ExactGroupPlan(group.videoId(), keep.title(), keep, remove));
        }

        List<PossibleGroupPlan> possiblePlans = new ArrayList<>();
        int counter = 1;
        for (DuplicateTrackDetector.PossibleGroup group : result.possible()) {
            List<PlaylistItemRecord> members = toRecords(group.items(), items);
            possiblePlans.add(new PossibleGroupPlan("pd-" + counter++, round(group.similarity()), members));
        }

        return new RemovalPlan(exactPlans, possiblePlans);
    }

    private PlaylistItemRecord choosePreferred(List<PlaylistItemRecord> members, String preferredPlaylistId) {
        if (preferredPlaylistId != null) {
            for (PlaylistItemRecord m : members) {
                if (preferredPlaylistId.equals(m.playlistId())) {
                    return m;
                }
            }
        }
        return members.get(0); // first encountered, preserving input order (playlist position order)
    }

    private List<PlaylistItemRecord> toRecords(List<DuplicateTrackDetector.TrackInput> trackInputs,
                                                List<PlaylistItemRecord> source) {
        // TrackInput carries the same identifying fields as PlaylistItemRecord; map back by
        // (playlistId, playlistItemId) identity to preserve the original object (and any
        // fields TrackInput doesn't carry, e.g. thumbnailUrl).
        List<PlaylistItemRecord> result = new ArrayList<>();
        for (DuplicateTrackDetector.TrackInput ti : trackInputs) {
            result.add(find(source, ti.playlistId(), ti.playlistItemId()));
        }
        return result;
    }

    private PlaylistItemRecord find(List<PlaylistItemRecord> source, String playlistId, String playlistItemId) {
        for (PlaylistItemRecord r : source) {
            if (r.playlistId().equals(playlistId) && r.playlistItemId().equals(playlistItemId)) {
                return r;
            }
        }
        throw new IllegalStateException("Detector referenced an item not present in the source list: "
                + playlistId + "/" + playlistItemId);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
