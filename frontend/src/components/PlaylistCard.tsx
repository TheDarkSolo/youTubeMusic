import type { Playlist } from "../api/types";
import { TrackList } from "./TrackList";

interface Props {
  playlist: Playlist;
  onDedupeClick: (playlist: Playlist) => void;
  dedupeLoading: boolean;
  dedupeDisabled: boolean;
  /** When true, shows a checkbox for bulk-selecting playlists to merge instead of the normal actions. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (playlist: Playlist) => void;
  /** Only passed for duplicate-group members that are eligible for deletion (§5.12 gating). */
  onDeleteClick?: (playlist: Playlist) => void;
  deleteLoading?: boolean;
  deleteDisabled?: boolean;
  /** §5.13/5.14 — general-purpose, shown on every card regardless of duplicate-group membership. */
  onLikeClick: (playlist: Playlist) => void;
  likeLoading?: boolean;
  likeDisabled?: boolean;
}

export function PlaylistCard({
  playlist,
  onDedupeClick,
  dedupeLoading,
  dedupeDisabled,
  selectable = false,
  selected = false,
  onToggleSelect,
  onDeleteClick,
  deleteLoading = false,
  deleteDisabled = false,
  onLikeClick,
  likeLoading = false,
  likeDisabled = false,
}: Props) {
  return (
    <div className={`playlist-card${selectable ? " playlist-card--selectable" : ""}`}>
      {selectable && (
        <label className="playlist-card__select">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(playlist)}
          />
          Select
        </label>
      )}
      <img
        className="playlist-card__thumb"
        src={playlist.thumbnailUrl}
        alt=""
        width={120}
        height={90}
      />
      <div className="playlist-card__body">
        <div className="playlist-card__title">{playlist.title}</div>
        <div className="playlist-card__count">
          {playlist.itemCount} track{playlist.itemCount === 1 ? "" : "s"}
        </div>
        <TrackList playlistId={playlist.id} />
        <button
          className="btn btn--secondary btn--small"
          disabled={dedupeDisabled}
          onClick={() => onDedupeClick(playlist)}
        >
          {dedupeLoading ? "Checking for duplicates…" : "Remove duplicate tracks"}
        </button>
        <button
          className="btn btn--secondary btn--small"
          disabled={likeDisabled}
          onClick={() => onLikeClick(playlist)}
          title="Like every track in this playlist so it shows up in your YouTube Music Liked Music — useful for a playlist imported from another service's Liked/Favorites list."
        >
          {likeLoading ? "Checking tracks…" : "Add to Liked Music"}
        </button>
        {onDeleteClick && (
          <button
            className="btn btn--danger btn--small"
            disabled={deleteDisabled}
            onClick={() => onDeleteClick(playlist)}
          >
            {deleteLoading ? "Deleting…" : "Delete playlist"}
          </button>
        )}
      </div>
    </div>
  );
}
