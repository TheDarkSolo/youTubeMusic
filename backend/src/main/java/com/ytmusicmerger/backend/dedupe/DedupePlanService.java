package com.ytmusicmerger.backend.dedupe;

import com.ytmusicmerger.backend.error.ApiException;
import com.ytmusicmerger.backend.plan.*;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.PlaylistService;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * §5.10/§5.11: standalone single-playlist dedupe. Shares its plan-token infrastructure
 * ({@link PlanCache}, {@link RemovalPlanBuilder}, {@link SnapshotHasher}) with
 * {@code MergePlanService}.
 */
@Service
public class DedupePlanService {

    private static final Duration PLAN_TTL = Duration.ofMinutes(5);
    // §5.10 estimatedQuota: playlistItems.delete costs 50 units under YouTube Data API v3's
    // published quota costs; list calls (1 unit) are ignored as negligible.
    private static final long WRITE_OP_QUOTA_COST = 50L;

    private final PlaylistService playlistService;
    private final RemovalPlanBuilder removalPlanBuilder;
    private final PlanCache<DedupePlanRecord> planCache = new PlanCache<>(PLAN_TTL);

    public DedupePlanService(PlaylistService playlistService, RemovalPlanBuilder removalPlanBuilder) {
        this.playlistService = playlistService;
        this.removalPlanBuilder = removalPlanBuilder;
    }

    public DedupePreviewResponse preview(DedupePreviewRequest request) {
        String playlistId = request.playlistId();
        if (playlistId == null || playlistId.isBlank()) {
            throw ApiException.validation("playlistId is required.");
        }

        List<PlaylistItemRecord> items = playlistService.fetchAllTracks(playlistId);
        String snapshotHash = SnapshotHasher.hash(items);

        RemovalPlanBuilder.RemovalPlan removalPlan = removalPlanBuilder.build(items, null);

        List<ExactRemovalGroupDto> exactDtos = removalPlan.exact().stream()
                .map(g -> new ExactRemovalGroupDto(g.videoId(), g.title(),
                        new PlaylistItemRefDto(g.keep().playlistId(), g.keep().playlistItemId()),
                        g.remove().stream().map(r -> new PlaylistItemRefDto(r.playlistId(), r.playlistItemId())).toList()))
                .toList();

        List<PossibleDuplicateGroupDto> possibleDtos = removalPlan.possible().stream()
                .map(g -> new PossibleDuplicateGroupDto(g.groupId(), g.similarity(),
                        g.items().stream().map(i -> new PossibleDupItemDto(i.playlistId(), i.playlistItemId(),
                                i.videoId(), i.title(), i.channelTitle())).toList()))
                .toList();

        int exactDuplicatesToRemove = removalPlan.exact().stream().mapToInt(g -> g.remove().size()).sum();
        DedupeSummaryDto summary = new DedupeSummaryDto(exactDuplicatesToRemove, possibleDtos.size());

        Map<String, RemovalPlanBuilder.PossibleGroupPlan> possibleById = removalPlan.possible().stream()
                .collect(Collectors.toMap(RemovalPlanBuilder.PossibleGroupPlan::groupId, g -> g, (a, b) -> a, LinkedHashMap::new));

        DedupePlanRecord record = new DedupePlanRecord(playlistId, removalPlan.exact(), possibleById, snapshotHash);
        PlanCache.PutResult put = planCache.put(record);

        long committedUnits = (long) exactDuplicatesToRemove * WRITE_OP_QUOTA_COST;
        long maxAdditionalUnits = removalPlan.possible().stream()
                .mapToLong(g -> (long) (g.items().size() - 1) * WRITE_OP_QUOTA_COST)
                .sum();
        EstimatedQuotaDto estimatedQuota = new EstimatedQuotaDto(committedUnits, maxAdditionalUnits);

        return new DedupePreviewResponse(put.token(), put.expiresAt(), playlistId,
                new DedupeRemovalsDto(exactDtos, possibleDtos), summary, estimatedQuota);
    }

    public DedupeExecuteResponse execute(DedupeExecuteRequest request) {
        if (request.planToken() == null) {
            throw ApiException.planNotFound("Plan expired or already used. Please re-run preview.");
        }
        DedupePlanRecord record = planCache.take(request.planToken())
                .orElseThrow(() -> ApiException.planNotFound("Plan expired or already used. Please re-run preview."));

        List<PlaylistItemRecord> currentItems = playlistService.fetchAllTracks(record.playlistId());
        String currentHash = SnapshotHasher.hash(currentItems);
        if (!currentHash.equals(record.snapshotHash())) {
            throw ApiException.planStale("The playlists changed since this plan was generated. Please re-run preview.");
        }

        Set<String> excludedExactVideoIds = request.excludedExactVideoIds() == null
                ? Set.of() : new HashSet<>(request.excludedExactVideoIds());
        Set<String> confirmedPossibleGroupIds = request.confirmedPossibleDuplicateGroupIds() == null
                ? Set.of() : new HashSet<>(request.confirmedPossibleDuplicateGroupIds());

        List<ExecuteErrorDto> errors = new ArrayList<>();

        int removedExact = 0;
        for (RemovalPlanBuilder.ExactGroupPlan group : record.exactGroups()) {
            if (excludedExactVideoIds.contains(group.videoId())) {
                continue;
            }
            for (PlaylistItemRecord toRemove : group.remove()) {
                try {
                    playlistService.deletePlaylistItem(toRemove.playlistItemId());
                    removedExact++;
                } catch (Exception e) {
                    errors.add(new ExecuteErrorDto("Failed to remove duplicate: " + e.getMessage(),
                            group.videoId(), toRemove.playlistId()));
                }
            }
        }

        int removedConfirmedPossible = 0;
        for (String groupId : confirmedPossibleGroupIds) {
            RemovalPlanBuilder.PossibleGroupPlan group = record.possibleGroupsById().get(groupId);
            if (group == null || group.items().size() < 2) {
                continue;
            }
            List<PlaylistItemRecord> items = group.items();
            for (int i = 1; i < items.size(); i++) {
                PlaylistItemRecord toRemove = items.get(i);
                try {
                    playlistService.deletePlaylistItem(toRemove.playlistItemId());
                    removedConfirmedPossible++;
                } catch (Exception e) {
                    errors.add(new ExecuteErrorDto("Failed to remove possible duplicate: " + e.getMessage(),
                            toRemove.videoId(), toRemove.playlistId()));
                }
            }
        }

        String status = errors.isEmpty() ? "completed" : "partial";
        return new DedupeExecuteResponse(status, record.playlistId(), removedExact, removedConfirmedPossible, errors);
    }
}
