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
}

export function PlaylistCard({
  playlist,
  onDedupeClick,
  dedupeLoading,
  dedupeDisabled,
  selectable = false,
  selected = false,
  onToggleSelect,
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
      </div>
    </div>
  );
}
