import { useState } from "react";
import { api } from "../api/client";
import type { PlaylistTrackItem } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

/** Lazily-loaded, paginated track list for one playlist (GET /api/playlists/{id}/tracks). */
export function TrackList({ playlistId }: { playlistId: string }) {
  const [items, setItems] = useState<PlaylistTrackItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { reportError, quotaCoolingDown } = useErrors();

  async function loadPage(pageToken?: string) {
    setLoading(true);
    try {
      const res = await api.getPlaylistTracks(playlistId, pageToken);
      setItems((prev) => (pageToken ? [...prev, ...res.items] : res.items));
      setNextPageToken(res.nextPageToken);
      setLoaded(true);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }

  if (!loaded) {
    return (
      <button className="btn btn--link" disabled={loading} onClick={() => loadPage()}>
        {loading ? "Loading tracks…" : "Show tracks"}
      </button>
    );
  }

  return (
    <div className="track-list">
      <ul>
        {items.map((item) => (
          <li key={item.playlistItemId} className="track-list__item">
            {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" width={40} height={30} />}
            <div>
              <div className="track-list__title">{item.title}</div>
              <div className="track-list__channel">{item.channelTitle}</div>
            </div>
          </li>
        ))}
      </ul>
      {loading && <Spinner label="Loading more…" />}
      {!loading && nextPageToken && (
        <button
          className="btn btn--link"
          disabled={quotaCoolingDown}
          onClick={() => loadPage(nextPageToken)}
        >
          Load more
        </button>
      )}
    </div>
  );
}
