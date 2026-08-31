import type { DuplicateGroup, Playlist } from "../api/types";
import { PlaylistCard } from "./PlaylistCard";

interface Props {
  group: DuplicateGroup;
  playlists: Playlist[];
  onMergeClick: (group: DuplicateGroup) => void;
  onDedupeClick: (playlist: Playlist) => void;
  dedupeLoadingPlaylistId: string | null;
  dedupeDisabled: boolean;
}

/** A bordered cluster of playlists the backend flagged as likely duplicates of each other. */
export function DuplicateGroupCard({
  group,
  playlists,
  onMergeClick,
  onDedupeClick,
  dedupeLoadingPlaylistId,
  dedupeDisabled,
}: Props) {
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
        {playlists.map((p) => (
          <PlaylistCard
            key={p.id}
            playlist={p}
            onDedupeClick={onDedupeClick}
            dedupeLoading={dedupeLoadingPlaylistId === p.id}
            dedupeDisabled={dedupeDisabled}
          />
        ))}
      </div>
    </div>
  );
}
