import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type {
  DedupeExecuteResponse,
  DedupePreviewResponse,
  MergeExecuteResponse,
  MergePreviewResponse,
  MergeTarget,
  Playlist,
  PlaylistsResponse,
} from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { DedupeReview } from "./DedupeReview";
import { DuplicateGroupCard } from "./DuplicateGroupCard";
import { MergeReview } from "./MergeReview";
import { MergeSetup } from "./MergeSetup";
import { Modal } from "./Modal";
import { PlaylistCard } from "./PlaylistCard";
import { Spinner } from "./Spinner";

type Overlay =
  | { kind: "mergeSetup"; initialPlaylistIds: string[] }
  | { kind: "mergeReview"; preview: MergePreviewResponse; sourcePlaylistIds: string[]; target: MergeTarget }
  | { kind: "mergeDone"; result: MergeExecuteResponse }
  | { kind: "dedupeReview"; preview: DedupePreviewResponse; playlistTitle: string }
  | { kind: "dedupeDone"; result: DedupeExecuteResponse }
  | null;

interface Props {
  channelTitle?: string;
  onLoggedOut: () => void;
}

export function PlaylistsPage({ channelTitle, onLoggedOut }: Props) {
  const [data, setData] = useState<PlaylistsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [dedupeLoadingId, setDedupeLoadingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { reportError, quotaCoolingDown } = useErrors();

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPlaylists();
      setData(res);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      reportError(err);
    } finally {
      onLoggedOut();
    }
  }

  async function handleDedupeClick(playlist: Playlist) {
    setDedupeLoadingId(playlist.id);
    try {
      const preview = await api.dedupePreview({ playlistId: playlist.id });
      setOverlay({ kind: "dedupeReview", preview, playlistTitle: playlist.title });
    } catch (err) {
      reportError(err);
    } finally {
      setDedupeLoadingId(null);
    }
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelectPlaylist(playlist: Playlist) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playlist.id)) next.delete(playlist.id);
      else next.add(playlist.id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  /** Cancel/close handler for any step of the merge flow: also resets select mode. */
  function closeMergeFlow() {
    setOverlay(null);
    exitSelectMode();
  }

  const playlists = data?.playlists ?? [];
  const groups = data?.duplicateGroups ?? [];
  const groupedIds = new Set(groups.flatMap((g) => g.playlistIds));
  const singles = playlists.filter((p) => !groupedIds.has(p.id));
  const selectedCount = selectedIds.size;
  const selectedPlaylists = playlists.filter((p) => selectedIds.has(p.id));

  return (
    <div className="page">
      <header className="page__header">
        <h1>YT Music Manager</h1>
        <div className="page__header-actions">
          {channelTitle && <span className="muted">Signed in as {channelTitle}</span>}
          <button
            className={`btn btn--small ${selectMode ? "btn--primary" : "btn--secondary"}`}
            onClick={toggleSelectMode}
          >
            {selectMode ? "Cancel selecting" : "Select playlists to merge"}
          </button>
          <button className="btn btn--secondary btn--small" onClick={fetchPlaylists} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn--tertiary btn--small" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {loading && <Spinner label="Loading playlists…" />}

      {!loading && data && (
        <>
          {groups.length > 0 && (
            <section>
              <h2>Possible duplicate groups</h2>
              {groups.map((g) => (
                <DuplicateGroupCard
                  key={g.id}
                  group={g}
                  playlists={playlists}
                  onMergeClick={(group) =>
                    setOverlay({ kind: "mergeSetup", initialPlaylistIds: group.playlistIds })
                  }
                  onDedupeClick={handleDedupeClick}
                  dedupeLoadingPlaylistId={dedupeLoadingId}
                  dedupeDisabled={quotaCoolingDown || dedupeLoadingId !== null}
                  selectable={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelectPlaylist}
                />
              ))}
            </section>
          )}

          <section>
            <h2>All other playlists</h2>
            {singles.length === 0 ? (
              <p className="hint">No other playlists.</p>
            ) : (
              <div className="playlist-grid">
                {singles.map((p) => (
                  <PlaylistCard
                    key={p.id}
                    playlist={p}
                    onDedupeClick={handleDedupeClick}
                    dedupeLoading={dedupeLoadingId === p.id}
                    dedupeDisabled={quotaCoolingDown || dedupeLoadingId !== null}
                    selectable={selectMode}
                    selected={selectedIds.has(p.id)}
                    onToggleSelect={toggleSelectPlaylist}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {selectMode && (
        <div className="select-bar">
          <span>
            {selectedCount} selected
            {selectedCount > 0 && (
              <span className="muted">
                {" "}
                ({selectedPlaylists.map((p) => p.title).join(", ")})
              </span>
            )}
          </span>
          <button
            className="btn btn--primary btn--small"
            disabled={selectedCount < 2}
            onClick={() =>
              setOverlay({ kind: "mergeSetup", initialPlaylistIds: [...selectedIds] })
            }
          >
            Merge selected
          </button>
        </div>
      )}

      {overlay?.kind === "mergeSetup" && (
        <Modal title="Merge playlists" onClose={closeMergeFlow}>
          <MergeSetup
            initialPlaylistIds={overlay.initialPlaylistIds}
            playlists={playlists}
            onCancel={closeMergeFlow}
            onPreviewReady={(preview, sourcePlaylistIds, target) =>
              setOverlay({ kind: "mergeReview", preview, sourcePlaylistIds, target })
            }
          />
        </Modal>
      )}

      {overlay?.kind === "mergeReview" && (
        <Modal title="Review merge" onClose={closeMergeFlow} wide>
          <MergeReview
            preview={overlay.preview}
            sourcePlaylistIds={overlay.sourcePlaylistIds}
            target={overlay.target}
            onCancel={closeMergeFlow}
            onCompleted={(result) => {
              setOverlay({ kind: "mergeDone", result });
              exitSelectMode();
              fetchPlaylists();
            }}
          />
        </Modal>
      )}

      {overlay?.kind === "mergeDone" && (
        <Modal title="Merge complete" onClose={() => setOverlay(null)}>
          <p>
            Status: <strong>{overlay.result.status}</strong>. Added {overlay.result.added} tracks,
            removed {overlay.result.removedExact} exact and {overlay.result.removedConfirmedPossible}{" "}
            confirmed possible duplicates into "{overlay.result.target.title}".
          </p>
          {overlay.result.errors.length > 0 && (
            <p className="hint hint--warn">{overlay.result.errors.length} item(s) failed — see server logs.</p>
          )}
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={() => setOverlay(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}

      {overlay?.kind === "dedupeReview" && (
        <Modal title={`Remove duplicates — ${overlay.playlistTitle}`} onClose={() => setOverlay(null)} wide>
          <DedupeReview
            preview={overlay.preview}
            playlistTitle={overlay.playlistTitle}
            onCancel={() => setOverlay(null)}
            onCompleted={(result) => {
              setOverlay({ kind: "dedupeDone", result });
              fetchPlaylists();
            }}
          />
        </Modal>
      )}

      {overlay?.kind === "dedupeDone" && (
        <Modal title="Duplicates removed" onClose={() => setOverlay(null)}>
          <p>
            Removed {overlay.result.removedExact} exact and {overlay.result.removedConfirmedPossible}{" "}
            confirmed possible duplicates.
          </p>
          {overlay.result.errors.length > 0 && (
            <p className="hint hint--warn">{overlay.result.errors.length} item(s) failed — see server logs.</p>
          )}
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={() => setOverlay(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
