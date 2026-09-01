import type { DuplicateGroup, Playlist } from "../api/types";
import { PlaylistCard } from "./PlaylistCard";

interface Props {
  group: DuplicateGroup;
  playlists: Playlist[];
  onMergeClick: (group: DuplicateGroup) => void;
  onDedupeClick: (playlist: Playlist) => void;
  dedupeLoadingPlaylistId: string | null;
  dedupeDisabled: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (playlist: Playlist) => void;
  onDeleteClick?: (playlist: Playlist) => void;
  deleteLoadingPlaylistId?: string | null;
  deleteDisabled?: boolean;
}

/** A bordered cluster of playlists the backend flagged as likely duplicates of each other. */
export function DuplicateGroupCard({
  group,
  playlists,
  onMergeClick,
  onDedupeClick,
  dedupeLoadingPlaylistId,
  dedupeDisabled,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onDeleteClick,
  deleteLoadingPlaylistId = null,
  deleteDisabled = false,
}: Props) {
  const members = playlists.filter((p) => group.playlistIds.includes(p.id));
  // §5.12 gating: only the "losing" side of the group (strictly fewer tracks than the
  // largest member) is eligible for the delete action.
  const maxItemCount = Math.max(...members.map((p) => p.itemCount));
  const isDeletable = (p: Playlist) => p.itemCount < maxItemCount;
  return (
    <div className="dup-group">
      <div className="dup-group__header">
        <span className={`badge badge--${group.matchType}`}>
          Possible duplicates · {group.matchType === "exact" ? "exact match" : "fuzzy match"} ·{" "}
          {Math.round(group.confidence * 100)}% confidence
        </span>
        <button className="btn btn--primary btn--small" onClick={() => onMergeClick(group)}>
          Merge these playlists
        </button>
      </div>
      <div className="dup-group__members">
        {members.map((p) => (
          <PlaylistCard
            key={p.id}
            playlist={p}
            onDedupeClick={onDedupeClick}
            dedupeLoading={dedupeLoadingPlaylistId === p.id}
            dedupeDisabled={dedupeDisabled}
            selectable={selectable}
            selected={selectedIds?.has(p.id) ?? false}
            onToggleSelect={onToggleSelect}
            onDeleteClick={isDeletable(p) ? onDeleteClick : undefined}
            deleteLoading={deleteLoadingPlaylistId === p.id}
            deleteDisabled={deleteDisabled}
          />
        ))}
      </div>
    </div>
  );
}
