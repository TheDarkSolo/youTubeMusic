import type { Playlist } from "../api/types";
import { TrackList } from "./TrackList";

/** Small heart glyph for the "Add to Liked Music" action — echoes the Logo's hand-authored SVG style. */
function HeartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M8 13.4C4.9 11.3 2.6 9.2 2.6 6.6c0-2 1.6-3.5 3.5-3.5 1.1 0 2.2.55 2.9 1.5.7-.95 1.8-1.5 2.9-1.5 1.9 0 3.5 1.5 3.5 3.5 0 2.6-2.3 4.7-5.4 6.8L8 13.4z"
        fill="currentColor"
      />
    </svg>
  );
}

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
        <div className="playlist-card__title" title={playlist.title}>
          {playlist.title}
        </div>
        <div className="playlist-card__count">
          {playlist.itemCount} track{playlist.itemCount === 1 ? "" : "s"}
        </div>
        <TrackList playlistId={playlist.id} />
        <div className="playlist-card__actions">
          <button
            className="btn btn--secondary btn--small"
            disabled={dedupeDisabled}
            onClick={() => onDedupeClick(playlist)}
          >
            {dedupeLoading ? "Checking for duplicates…" : "Remove duplicate tracks"}
          </button>
          <button
            className="btn btn--secondary btn--small btn--like"
            disabled={likeDisabled}
            onClick={() => onLikeClick(playlist)}
            title="Like every track here so it appears in your YouTube Music Liked Music — handy for a playlist imported from another service (e.g. a Spotify Liked Songs export)."
          >
            <HeartIcon />
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
    </div>
  );
}
