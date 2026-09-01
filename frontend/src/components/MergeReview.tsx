import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { MergeExecuteResponse, MergePreviewResponse, MergeTarget } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

interface Props {
  preview: MergePreviewResponse;
  sourcePlaylistIds: string[];
  target: MergeTarget;
  onCancel: () => void;
  onCompleted: (result: MergeExecuteResponse) => void;
}

/**
 * Step 2 of the merge flow: review the dry-run plan and confirm.
 */
export function MergeReview({ preview, sourcePlaylistIds, target, onCancel, onCompleted }: Props) {
  const [uncheckedExact, setUncheckedExact] = useState<Set<string>>(new Set());
  const [confirmedPossible, setConfirmedPossible] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [rePreviewing, setRePreviewing] = useState(false);
  const [livePreview, setLivePreview] = useState(preview);
  const { reportError, quotaCoolingDown } = useErrors();

  const playlistTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const sp of livePreview.sourcePlaylists) map.set(sp.playlistId, sp.title);
    if (livePreview.target.playlistId) map.set(livePreview.target.playlistId, livePreview.target.title);
    return map;
  }, [livePreview]);

  function toggleExact(videoId: string) {
    setUncheckedExact((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  const exactTotal = livePreview.plannedRemovals.exact.length;
  const allExactIncluded = uncheckedExact.size === 0;
  const allExactExcluded = exactTotal > 0 && uncheckedExact.size === exactTotal;
  const selectAllExactRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllExactRef.current) {
      selectAllExactRef.current.indeterminate = !allExactIncluded && !allExactExcluded;
    }
  }, [allExactIncluded, allExactExcluded]);

  function toggleAllExact() {
    setUncheckedExact(
      allExactIncluded ? new Set(livePreview.plannedRemovals.exact.map((r) => r.videoId)) : new Set(),
    );
  }

  function togglePossible(groupId: string) {
    setConfirmedPossible((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  const exactCheckedCount = livePreview.plannedRemovals.exact.length - uncheckedExact.size;
  const possibleConfirmedCount = confirmedPossible.size;
  const addCount = livePreview.plannedAdds.length;
  const sourceCount = livePreview.sourcePlaylists.length;

  const summary = useMemo(() => {
    const parts = [
      `Merge ${sourceCount} playlist${sourceCount === 1 ? "" : "s"} into '${livePreview.target.title}'`,
      `add ${addCount} track${addCount === 1 ? "" : "s"}`,
    ];
    if (exactCheckedCount > 0) {
      parts.push(`remove ${exactCheckedCount} exact duplicate${exactCheckedCount === 1 ? "" : "s"}`);
    }
    if (possibleConfirmedCount > 0) {
      parts.push(
        `remove ${possibleConfirmedCount} possible-duplicate group${possibleConfirmedCount === 1 ? "" : "s"}`,
      );
    }
    return parts.join(", ") + ".";
  }, [sourceCount, livePreview.target.title, addCount, exactCheckedCount, possibleConfirmedCount]);

  // Recomputed live from current checkbox state, per §5.8's note that this is a pure
  // function of already-known counts — keeps the estimate accurate as selections change,
  // rather than showing the static server value from the initial preview.
  const liveCommittedUnits =
    (addCount + exactCheckedCount) * 50 + (livePreview.target.mode === "create" ? 50 : 0);
  const liveAdditionalUnits = possibleConfirmedCount * 50;
  const quotaIsHigh = liveCommittedUnits > 7000;

  async function handleRePreview() {
    setRePreviewing(true);
    try {
      const fresh = await api.mergePreview({ sourcePlaylistIds, target });
      setLivePreview(fresh);
      setUncheckedExact(new Set());
      setConfirmedPossible(new Set());
      setStale(false);
    } catch (err) {
      reportError(err);
    } finally {
      setRePreviewing(false);
    }
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await api.mergeExecute({
        planToken: livePreview.planToken,
        confirmedPossibleDuplicateGroupIds: [...confirmedPossible],
        excludedExactVideoIds: [...uncheckedExact],
      });
      onCompleted(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAN_STALE") {
        setStale(true);
      } else {
        reportError(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (stale) {
    return (
      <div className="stale-panel">
        <p>The playlists changed since this plan was generated. Please re-run preview.</p>
        <div className="modal__actions">
          <button className="btn btn--tertiary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={rePreviewing} onClick={handleRePreview}>
            {rePreviewing ? "Re-running preview…" : "Re-run preview"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="merge-review">
      <section>
        <h3>Tracks to add ({addCount})</h3>
        {addCount > 0 ? (
          <details>
            <summary>Show track list</summary>
            <ul className="plain-list">
              {livePreview.plannedAdds.map((a) => (
                <li key={a.videoId}>
                  {a.title} <span className="muted">from {playlistTitleById.get(a.fromPlaylistId) ?? a.fromPlaylistId}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="hint">Nothing new to add.</p>
        )}
      </section>

      <section>
        <h3>Exact duplicates to remove ({livePreview.plannedRemovals.exact.length})</h3>
        {livePreview.plannedRemovals.exact.length === 0 ? (
          <p className="hint">No exact duplicates found.</p>
        ) : (
          <>
            <label className="select-all-row">
              <input
                ref={selectAllExactRef}
                type="checkbox"
                checked={allExactIncluded}
                onChange={toggleAllExact}
              />
              <strong>Also remove duplicate tracks</strong>
              <span className="muted">
                {" "}
                — uncheck to only add the {addCount} new track{addCount === 1 ? "" : "s"} and skip all {exactTotal}{" "}
                removal{exactTotal === 1 ? "" : "s"} (removals cost most of the quota; you can also do them
                yourself in YouTube Music).
              </span>
            </label>
            <ul className="checkbox-list">
              {livePreview.plannedRemovals.exact.map((r) => (
                <li key={r.videoId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!uncheckedExact.has(r.videoId)}
                      onChange={() => toggleExact(r.videoId)}
                    />
                    {r.title} — keep in {playlistTitleById.get(r.keep.playlistId) ?? r.keep.playlistId},
                    remove from{" "}
                    {r.remove
                      .map((x) => playlistTitleById.get(x.playlistId) ?? x.playlistId)
                      .join(", ")}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>
          Possible duplicates ({livePreview.plannedRemovals.possibleDuplicates.length} group
          {livePreview.plannedRemovals.possibleDuplicates.length === 1 ? "" : "s"})
        </h3>
        {livePreview.plannedRemovals.possibleDuplicates.length === 0 ? (
          <p className="hint">No possible duplicates found.</p>
        ) : (
          <ul className="checkbox-list">
            {livePreview.plannedRemovals.possibleDuplicates.map((g) => (
              <li key={g.groupId}>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmedPossible.has(g.groupId)}
                    onChange={() => togglePossible(g.groupId)}
                  />
                  {Math.round(g.similarity * 100)}% similar:{" "}
                  {g.items
                    .map((it) => `"${it.title}" (${it.channelTitle}, ${playlistTitleById.get(it.playlistId) ?? it.playlistId})`)
                    .join(" vs. ")}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="summary-line">{summary}</p>
      <p className={quotaIsHigh ? "hint hint--warn" : "hint"}>
        Estimated YouTube API quota: ~{liveCommittedUnits} units
        {liveAdditionalUnits > 0 ? ` (+ up to ${liveAdditionalUnits} more if all possible duplicates confirmed)` : ""}
        {" "}— your daily limit is 10,000 units.
      </p>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          disabled={submitting || quotaCoolingDown}
          onClick={handleConfirm}
        >
          {submitting ? "Merging…" : "Confirm merge"}
        </button>
      </div>
      {submitting && <Spinner label="Applying merge…" />}
    </div>
  );
}
