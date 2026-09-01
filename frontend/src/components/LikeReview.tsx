import { useState } from "react";
import { api } from "../api/client";
import type { LikeAllResponse, LikePreviewResponse } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

interface Props {
  preview: LikePreviewResponse;
  playlistTitle: string;
  onCancel: () => void;
  onCompleted: (result: LikeAllResponse) => void;
}

/**
 * §5.13/5.14 — confirm dialog for bulk-liking every not-yet-liked track in a playlist.
 * No plan-token/staleness machinery here (unlike merge/dedupe): like-all is idempotent
 * and re-fetches fresh state at execute time, so there's nothing to go stale.
 */
export function LikeReview({ preview, playlistTitle, onCancel, onCompleted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const { reportError, quotaCoolingDown } = useErrors();

  const quotaIsHigh = preview.estimatedQuota.committedUnits > 7000;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await api.likeAll(preview.playlistId);
      onCompleted(result);
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (preview.toLike === 0) {
    return (
      <div className="like-review">
        <p className="hint">
          All {preview.totalTracks} track{preview.totalTracks === 1 ? "" : "s"} in "{playlistTitle}" are
          already in your Liked Music — nothing to do.
        </p>
        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="like-review">
      <div className="like-review__stats">
        <div className="like-review__stat">
          <span className="like-review__stat-value">{preview.toLike}</span>
          <span className="like-review__stat-label">To like</span>
        </div>
        <div className="like-review__stat like-review__stat--muted">
          <span className="like-review__stat-value">{preview.alreadyLiked}</span>
          <span className="like-review__stat-label">Already liked</span>
        </div>
        <div className="like-review__stat like-review__stat--muted">
          <span className="like-review__stat-value">{preview.totalTracks}</span>
          <span className="like-review__stat-label">Total tracks</span>
        </div>
      </div>
      <p className="summary-line">
        Like {preview.toLike} track{preview.toLike === 1 ? "" : "s"} from "{playlistTitle}" and add
        {preview.toLike === 1 ? " it" : " them"} to Liked Music.
      </p>
      <p className={quotaIsHigh ? "hint hint--warn" : "hint"}>
        Estimated YouTube API quota: ~{preview.estimatedQuota.committedUnits} units — your daily limit
        is 10,000 units.
      </p>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          disabled={submitting || quotaCoolingDown}
          onClick={handleConfirm}
        >
          {submitting
            ? "Liking…"
            : `Like ${preview.toLike} track${preview.toLike === 1 ? "" : "s"}`}
        </button>
      </div>
      {submitting && <Spinner label="Liking tracks…" />}
    </div>
  );
}
