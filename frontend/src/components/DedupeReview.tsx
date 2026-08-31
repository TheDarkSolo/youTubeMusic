import { useMemo, useState } from "react";
import { ApiError, api } from "../api/client";
import type { DedupeExecuteResponse, DedupePreviewResponse } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

interface Props {
  preview: DedupePreviewResponse;
  playlistTitle: string;
  onCancel: () => void;
  onCompleted: (result: DedupeExecuteResponse) => void;
}

/** Standalone per-playlist "remove duplicate tracks" preview/confirm, mirrors MergeReview. */
export function DedupeReview({ preview, playlistTitle, onCancel, onCompleted }: Props) {
  const [uncheckedExact, setUncheckedExact] = useState<Set<string>>(new Set());
  const [confirmedPossible, setConfirmedPossible] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const [rePreviewing, setRePreviewing] = useState(false);
  const [livePreview, setLivePreview] = useState(preview);
  const { reportError, quotaCoolingDown } = useErrors();

  const exactCheckedCount = livePreview.removals.exact.length - uncheckedExact.size;
  const possibleConfirmedCount = confirmedPossible.size;

  const summary = useMemo(() => {
    const parts = [`Remove duplicate tracks from '${playlistTitle}'`];
    parts.push(`${exactCheckedCount} exact duplicate${exactCheckedCount === 1 ? "" : "s"}`);
    if (possibleConfirmedCount > 0) {
      parts.push(
        `${possibleConfirmedCount} possible-duplicate group${possibleConfirmedCount === 1 ? "" : "s"}`,
      );
    }
    return parts.join(": ") + ".";
  }, [playlistTitle, exactCheckedCount, possibleConfirmedCount]);

  function toggleExact(videoId: string) {
    setUncheckedExact((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  function togglePossible(groupId: string) {
    setConfirmedPossible((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  async function handleRePreview() {
    setRePreviewing(true);
    try {
      const fresh = await api.dedupePreview({ playlistId: livePreview.playlistId });
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
      const result = await api.dedupeExecute({
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
        <p>The playlist changed since this plan was generated. Please re-run preview.</p>
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
        <h3>Exact duplicates to remove ({livePreview.removals.exact.length})</h3>
        {livePreview.removals.exact.length === 0 ? (
          <p className="hint">No exact duplicates found.</p>
        ) : (
          <>
            <ul className="checkbox-list">
              {livePreview.removals.exact.map((r) => (
                <li key={r.videoId}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!uncheckedExact.has(r.videoId)}
                      onChange={() => toggleExact(r.videoId)}
                    />
                    {r.title} ({r.remove.length} duplicate copy{r.remove.length === 1 ? "" : "ies"})
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3>
          Possible duplicates ({livePreview.removals.possibleDuplicates.length} group
          {livePreview.removals.possibleDuplicates.length === 1 ? "" : "s"})
        </h3>
        {livePreview.removals.possibleDuplicates.length === 0 ? (
          <p className="hint">No possible duplicates found.</p>
        ) : (
          <ul className="checkbox-list">
            {livePreview.removals.possibleDuplicates.map((g) => (
              <li key={g.groupId}>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmedPossible.has(g.groupId)}
                    onChange={() => togglePossible(g.groupId)}
                  />
                  {Math.round(g.similarity * 100)}% similar:{" "}
                  {g.items.map((it) => `"${it.title}" (${it.channelTitle})`).join(" vs. ")}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="summary-line">{summary}</p>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          disabled={submitting || quotaCoolingDown}
          onClick={handleConfirm}
        >
          {submitting ? "Removing…" : "Confirm removal"}
        </button>
      </div>
      {submitting && <Spinner label="Removing duplicate tracks…" />}
    </div>
  );
}
