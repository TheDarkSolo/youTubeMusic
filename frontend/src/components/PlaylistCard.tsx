import type { Playlist } from "../api/types";
import { TrackList } from "./TrackList";

interface Props {
  playlist: Playlist;
  onDedupeClick: (playlist: Playlist) => void;
  dedupeLoading: boolean;
  dedupeDisabled: boolean;
}

export function PlaylistCard({ playlist, onDedupeClick, dedupeLoading, dedupeDisabled }: Props) {
  return (
    <div className="playlist-card">
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
