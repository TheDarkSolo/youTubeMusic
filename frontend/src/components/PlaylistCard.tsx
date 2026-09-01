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

/** Two overlapping squares — the standard "duplicate/copy" glyph — for "Remove duplicate tracks". */
function DuplicateIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" fill="currentColor" fillOpacity="0.45" />
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** Simple filled trash glyph for "Delete playlist" — matches the flat, geometric style of the other action icons. */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <rect x="6" y="2.4" width="4" height="1.6" rx="0.8" fill="currentColor" />
      <rect x="3" y="4.6" width="10" height="1.5" rx="0.75" fill="currentColor" />
      <path
        d="M4.3 6.7h7.4l-.66 6.86a1.1 1.1 0 0 1-1.1 1H6.06a1.1 1.1 0 0 1-1.1-1L4.3 6.7z"
        fill="currentColor"
        fillOpacity="0.9"
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
            <DuplicateIcon />
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
              <TrashIcon />
              {deleteLoading ? "Deleting…" : "Delete playlist"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
