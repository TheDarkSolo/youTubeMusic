package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.plan.RemovalPlanBuilder;

import java.util.List;
import java.util.Map;

/** Everything needed to execute a previously-previewed standalone dedupe, cached by planToken. */
record DedupePlanRecord(
        String playlistId,
        List<RemovalPlanBuilder.ExactGroupPlan> exactGroups,
        Map<String, RemovalPlanBuilder.PossibleGroupPlan> possibleGroupsById,
        String snapshotHash) {
}
