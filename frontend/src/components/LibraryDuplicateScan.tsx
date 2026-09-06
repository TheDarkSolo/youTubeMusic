import { useMemo } from "react";
import type { LibraryDuplicateScanResponse, LibraryDuplicateScanRow } from "../api/types";

interface Props {
  scan: LibraryDuplicateScanResponse;
  onCancel: () => void;
  onCleanupClick: (row: LibraryDuplicateScanRow) => void;
  cleanupLoadingPlaylistId: string | null;
  cleanupDisabled: boolean;
}

function totalCleanupCount(row: LibraryDuplicateScanRow): number {
  return row.exactDuplicateTracks + row.possibleDuplicateGroups;
}

function summaryFor(row: LibraryDuplicateScanRow): string {
  const parts: string[] = [];
  if (row.exactDuplicateTracks > 0) {
    parts.push(
      `${row.exactDuplicateTracks} exact duplicate${row.exactDuplicateTracks === 1 ? "" : "s"}`,
    );
  }
  if (row.possibleDuplicateGroups > 0) {
    parts.push(
      `${row.possibleDuplicateGroups} possible match${row.possibleDuplicateGroups === 1 ? "" : "es"}`,
    );
  }
  return parts.join(", ");
}

/**
 * §5.17 — library-wide duplicate scan results. Read-only report: ranks every playlist the
 * backend flagged as having something worth cleaning up. "Clean up" hands off entirely to the
 * existing per-playlist dedupe preview/review/confirm flow (§5.10/§5.11) via `onCleanupClick` —
 * there is no separate execute path here, matching the doc's explicit non-goal.
 */
export function LibraryDuplicateScan({
  scan,
  onCancel,
  onCleanupClick,
  cleanupLoadingPlaylistId,
  cleanupDisabled,
}: Props) {
  const rows = useMemo(
    () => [...scan.playlists].sort((a, b) => totalCleanupCount(b) - totalCleanupCount(a)),
    [scan.playlists],
  );

  if (rows.length === 0) {
    return (
      <div className="library-scan">
        <p className="hint">No duplicates found anywhere in your library.</p>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="library-scan">
      <p className="hint">
        {rows.length} playlist{rows.length === 1 ? "" : "s"} with cleanup available, ranked by how
        much there is to clean up.
      </p>
      <ul className="library-scan__list">
        {rows.map((row) => (
          <li key={row.playlistId} className="library-scan__row">
            <span className="badge library-scan__count" title="Tracks flagged for cleanup">
              {totalCleanupCount(row)}
            </span>
            <div className="library-scan__info">
              <strong>{row.title}</strong>
              <span className="muted">
                {" "}
                — {row.itemCount} track{row.itemCount === 1 ? "" : "s"}
              </span>
              <div className="hint">{summaryFor(row)}</div>
            </div>
            <button
              className="btn btn--secondary btn--small"
              disabled={cleanupDisabled || cleanupLoadingPlaylistId === row.playlistId}
              onClick={() => onCleanupClick(row)}
            >
              {cleanupLoadingPlaylistId === row.playlistId ? "Loading…" : "Clean up"}
            </button>
          </li>
        ))}
      </ul>
      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel}>
          Close
        </button>
      </div>
    </div>
  );
}
