package com.ytmusicmerger.backend.merge;

import com.ytmusicmerger.backend.error.ApiException;
import com.ytmusicmerger.backend.plan.*;
import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.PlaylistMeta;
import com.ytmusicmerger.backend.playlist.PlaylistService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * §5.8/§5.9: builds a merge plan (dry run, no side effects) and later executes it against a
 * cached, single-use {@code planToken}. Shares its plan-token infrastructure ({@link PlanCache},
 * {@link RemovalPlanBuilder}, {@link SnapshotHasher}) with {@code DedupePlanService}.
 */
@Service
public class MergePlanService {

    private static final Duration PLAN_TTL = Duration.ofMinutes(5);

    private final PlaylistService playlistService;
    private final RemovalPlanBuilder removalPlanBuilder;
    private final PlanCache<MergePlanRecord> planCache = new PlanCache<>(PLAN_TTL);

    public MergePlanService(PlaylistService playlistService, RemovalPlanBuilder removalPlanBuilder) {
        this.playlistService = playlistService;
        this.removalPlanBuilder = removalPlanBuilder;
    }

    public MergePreviewResponse preview(MergePreviewRequest request) {
        List<String> sourceIds = request.sourcePlaylistIds();
        if (sourceIds == null || sourceIds.isEmpty()) {
            throw ApiException.validation("sourcePlaylistIds must contain at least one playlist id.");
        }
        MergeTargetRequest target = request.target();
        if (target == null || (!target.isCreate() && !target.isExisting())) {
            throw ApiException.validation("target.mode must be \"existing\" or \"create\".");
        }
        if (target.isExisting() && (target.playlistId() == null || target.playlistId().isBlank())) {
            throw ApiException.validation("target.playlistId is required when target.mode is \"existing\".");
        }
        if (target.isCreate() && (target.title() == null || target.title().isBlank())) {
            throw ApiException.validation("target.title is required when target.mode is \"create\".");
        }

        // Stable, de-duplicated scan order: requested sources first, then the existing
        // target playlist too (if not already among the sources) so we know what's already
        // there and can skip re-adding it.
        LinkedHashSet<String> involvedIds = new LinkedHashSet<>(sourceIds);
        if (target.isExisting()) {
            involvedIds.add(target.playlistId());
        }

        Map<String, PlaylistMeta> metaById = playlistService.fetchPlaylistMeta(new ArrayList<>(involvedIds))
                .stream().collect(Collectors.toMap(PlaylistMeta::id, m -> m));
        for (String id : involvedIds) {
            if (!metaById.containsKey(id)) {
                throw ApiException.notFound("Playlist not found or not accessible: " + id);
            }
        }

        String resolvedTargetTitle = target.isExisting() ? metaById.get(target.playlistId()).title() : target.title();
        MergeTargetRequest resolvedTarget = new MergeTargetRequest(target.mode(), target.playlistId(), resolvedTargetTitle);

        List<PlaylistItemRecord> allItems = new ArrayList<>();
        for (String id : involvedIds) {
            allItems.addAll(playlistService.fetchAllTracks(id));
        }

        String snapshotHash = SnapshotHasher.hash(allItems);

        String preferredKeepPlaylistId = target.isExisting() ? target.playlistId() : null;
        RemovalPlanBuilder.RemovalPlan removalPlan = removalPlanBuilder.build(allItems, preferredKeepPlaylistId);

        // Representative per unique videoId: the exact-group's "keep" if it's part of a
        // duplicate group, otherwise the (only) item itself.
        Map<String, PlaylistItemRecord> representativeByVideoId = new LinkedHashMap<>();
        for (PlaylistItemRecord item : allItems) {
            representativeByVideoId.putIfAbsent(item.videoId(), item);
        }
        for (RemovalPlanBuilder.ExactGroupPlan group : removalPlan.exact()) {
            representativeByVideoId.put(group.videoId(), group.keep());
        }

        List<MergePlanRecord.PlannedAddInternal> plannedAdds = new ArrayList<>();
        for (Map.Entry<String, PlaylistItemRecord> entry : representativeByVideoId.entrySet()) {
            PlaylistItemRecord rep = entry.getValue();
            boolean alreadyInTarget = target.isExisting() && target.playlistId().equals(rep.playlistId());
            if (!alreadyInTarget) {
                plannedAdds.add(new MergePlanRecord.PlannedAddInternal(rep.videoId(), rep.title(), rep.playlistId()));
            }
        }

        List<SourcePlaylistDto> sourcePlaylistDtos = new ArrayList<>();
        List<PlaylistMeta> sourceMetaOrdered = new ArrayList<>();
        for (String id : sourceIds) {
            PlaylistMeta meta = metaById.get(id);
            sourceMetaOrdered.add(meta);
            sourcePlaylistDtos.add(new SourcePlaylistDto(meta.id(), meta.title(), meta.itemCount()));
        }

        List<PlannedAddDto> plannedAddDtos = plannedAdds.stream()
                .map(a -> new PlannedAddDto(a.videoId(), a.title(), a.fromPlaylistId()))
                .toList();

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
        MergeSummaryDto summary = new MergeSummaryDto(plannedAddDtos.size(), exactDuplicatesToRemove, possibleDtos.size());

        Map<String, RemovalPlanBuilder.PossibleGroupPlan> possibleById = removalPlan.possible().stream()
                .collect(Collectors.toMap(RemovalPlanBuilder.PossibleGroupPlan::groupId, g -> g, (a, b) -> a, LinkedHashMap::new));

        MergePlanRecord record = new MergePlanRecord(resolvedTarget, sourceIds, sourceMetaOrdered, plannedAdds,
                removalPlan.exact(), possibleById, new ArrayList<>(involvedIds), snapshotHash);

        PlanCache.PutResult put = planCache.put(record);

        MergeTargetResponseDto targetDto = new MergeTargetResponseDto(resolvedTarget.mode(), resolvedTarget.playlistId(),
                resolvedTarget.title());

        return new MergePreviewResponse(put.token(), put.expiresAt(), targetDto, sourcePlaylistDtos, plannedAddDtos,
                new PlannedRemovalsDto(exactDtos, possibleDtos), summary);
    }

    public MergeExecuteResponse execute(MergeExecuteRequest request) {
        if (request.planToken() == null) {
            throw ApiException.planNotFound("Plan expired or already used. Please re-run preview.");
        }
        MergePlanRecord record = planCache.take(request.planToken())
                .orElseThrow(() -> ApiException.planNotFound("Plan expired or already used. Please re-run preview."));

        // §5.11 staleness check: re-fetch current content of every involved playlist and
        // compare against the snapshot hash captured at preview time.
        List<PlaylistItemRecord> currentItems = new ArrayList<>();
        for (String playlistId : record.involvedPlaylistIds()) {
            currentItems.addAll(playlistService.fetchAllTracks(playlistId));
        }
        String currentHash = SnapshotHasher.hash(currentItems);
        if (!currentHash.equals(record.snapshotHash())) {
            throw ApiException.planStale("The playlists changed since this plan was generated. Please re-run preview.");
        }

        Set<String> excludedExactVideoIds = request.excludedExactVideoIds() == null
                ? Set.of() : new HashSet<>(request.excludedExactVideoIds());
        Set<String> confirmedPossibleGroupIds = request.confirmedPossibleDuplicateGroupIds() == null
                ? Set.of() : new HashSet<>(request.confirmedPossibleDuplicateGroupIds());

        String targetPlaylistId;
        String targetTitle = record.target().title();
        if (record.target().isCreate()) {
            PlaylistMeta created = playlistService.createPlaylist(targetTitle);
            targetPlaylistId = created.id();
        } else {
            targetPlaylistId = record.target().playlistId();
        }

        List<ExecuteErrorDto> errors = new ArrayList<>();
        int added = 0;
        for (MergePlanRecord.PlannedAddInternal add : record.plannedAdds()) {
            try {
                playlistService.insertPlaylistItem(targetPlaylistId, add.videoId());
                added++;
            } catch (Exception e) {
                errors.add(new ExecuteErrorDto("Failed to add video: " + e.getMessage(), add.videoId(), targetPlaylistId));
            }
        }

        int removedExact = 0;
        for (RemovalPlanBuilder.ExactGroupPlan group : record.exactGroups()) {
            if (excludedExactVideoIds.contains(group.videoId())) {
                continue; // user unchecked this exact-duplicate group - keep all copies
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
                continue; // unknown/stale groupId - ignore rather than error
            }
            List<PlaylistItemRecord> items = group.items();
            // Keep the first item, remove the rest.
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
        return new MergeExecuteResponse(status, new TargetRefDto(targetPlaylistId, targetTitle), added, removedExact,
                removedConfirmedPossible, List.of(), errors);
    }
}
