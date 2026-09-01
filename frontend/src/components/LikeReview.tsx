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
        <p>
          All {preview.totalTracks} track{preview.totalTracks === 1 ? "" : "s"} in "{playlistTitle}" are
          already in your Liked Music. Nothing to do.
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
      <p>
        {preview.toLike} of {preview.totalTracks} track{preview.totalTracks === 1 ? "" : "s"} in "
        {playlistTitle}" {preview.toLike === 1 ? "is" : "are"} not yet liked
        {preview.alreadyLiked > 0
          ? ` (${preview.alreadyLiked} already liked and will be skipped)`
          : ""}
        .
      </p>
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
