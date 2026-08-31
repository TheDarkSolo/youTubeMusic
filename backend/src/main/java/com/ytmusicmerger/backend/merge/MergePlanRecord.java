package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.plan.RemovalPlanBuilder;
import com.ytmusicmerger.backend.playlist.PlaylistMeta;

import java.util.List;
import java.util.Map;

/** Everything needed to execute a previously-previewed merge, cached server-side by planToken. */
record MergePlanRecord(
        MergeTargetRequest target,
        List<String> requestedSourcePlaylistIds,
        List<PlaylistMeta> sourcePlaylistsMeta,
        List<PlannedAddInternal> plannedAdds,
        List<RemovalPlanBuilder.ExactGroupPlan> exactGroups,
        Map<String, RemovalPlanBuilder.PossibleGroupPlan> possibleGroupsById,
        List<String> involvedPlaylistIds,
        String snapshotHash) {

    record PlannedAddInternal(String videoId, String title, String fromPlaylistId) {
    }
}
