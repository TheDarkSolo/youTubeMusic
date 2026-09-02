import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LikeAllResponse, LikePreviewResponse } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { buildLikeAllScript } from "../lib/likeAllScript";
import { Spinner } from "./Spinner";

interface Props {
  preview: LikePreviewResponse;
  playlistTitle: string;
  onCancel: () => void;
  onCompleted: (result: LikeAllResponse) => void;
}

/** The console script clicks one Like button every 500ms — see likeAllScript.ts. */
const SCRIPT_SECONDS_PER_TRACK = 0.5;

function roughRuntime(trackCount: number): string {
  const seconds = Math.round(trackCount * SCRIPT_SECONDS_PER_TRACK);
  if (seconds < 90) return `about ${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * §5.13/5.14 — confirm dialog for bulk-liking every not-yet-liked track in a playlist.
 * No plan-token/staleness machinery here (unlike merge/dedupe): like-all is idempotent
 * and re-fetches fresh state at execute time, so there's nothing to go stale.
 *
 * Offers two genuine routes: the API one (precise, costs quota, capped at 10,000 units/day)
 * and a browser-console script the user runs on music.youtube.com themselves (free, no quota,
 * but slower and only as precise as what the page shows). We can't run that script for them —
 * different origin — so we hand it over with a copy button and instructions.
 */
export function LikeReview({ preview, playlistTitle, onCancel, onCompleted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const { reportError, quotaCoolingDown } = useErrors();

  const quotaIsHigh = preview.estimatedQuota.committedUnits > 7000;
  const playlistUrl = `https://music.youtube.com/playlist?list=${preview.playlistId}`;
  // Baked into the script so it can refuse to run on a half-loaded page rather than
  // silently liking only the rows YouTube Music happens to have rendered.
  const consoleScript = buildLikeAllScript(preview.totalTracks);

  // Revert the "Copied!" confirmation on its own; clears if the modal closes first.
  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

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

  async function handleCopyScript() {
    try {
      await navigator.clipboard.writeText(consoleScript);
      setCopyState("copied");
    } catch {
      // Clipboard access can be blocked (permissions, insecure context). Fall back to
      // showing the script so the user can select and copy it by hand.
      setCopyState("failed");
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
      <p className="hint">Two ways to do it — pick whichever suits this playlist.</p>

      <section className="like-route">
        <h3 className="like-route__title">Option 1 — Let the app do it</h3>
        <p className="hint">
          Precise: it already knows which {preview.alreadyLiked} track
          {preview.alreadyLiked === 1 ? " is" : "s are"} liked, skips them, and tells you exactly
          what happened. It costs YouTube API quota, and stops if your daily limit runs out.
        </p>
        <p className={quotaIsHigh ? "hint hint--warn" : "hint"}>
          Estimated YouTube API quota: ~{preview.estimatedQuota.committedUnits} units — your daily
          limit is 10,000 units.
        </p>
        <button
          className="btn btn--primary like-route__action"
          disabled={submitting || quotaCoolingDown}
          onClick={handleConfirm}
        >
          {submitting ? "Liking…" : `Like ${preview.toLike} track${preview.toLike === 1 ? "" : "s"}`}
        </button>
        {submitting && <Spinner label="Liking tracks…" />}
      </section>

      <section className="like-route like-route--free">
        <h3 className="like-route__title">Option 2 — Run a script in your browser (no quota)</h3>
        <p className="hint">
          Free — it clicks Like on the YouTube Music page itself, so it uses no API quota at all and
          can finish a whole large playlist in one go. It takes {roughRuntime(preview.toLike)},
          needs the YouTube Music tab left open the whole time, and is a little less precise: it
          likes what it can see on the page rather than a checked list.
        </p>
        <ol className="like-route__steps">
          <li>
            <a href={playlistUrl} target="_blank" rel="noopener noreferrer">
              Open "{playlistTitle}" on YouTube Music
            </a>{" "}
            in a new tab.
          </li>
          <li>Open the browser console (Cmd+Option+J on macOS, F12 on Windows/Linux).</li>
          <li>Copy the script below and paste it into the console.</li>
          <li>Press Enter.</li>
          <li>Leave the tab open until the console logs that it's done.</li>
        </ol>
        <p className="hint">
          You don't need to scroll the playlist first — the script does that itself, and checks
          that all {preview.totalTracks} tracks loaded before it likes anything. If it stops and
          says fewer than that are loaded, scroll to the very bottom of the playlist yourself
          until every row appears, then paste the script again.
        </p>
        <div className="like-route__copy">
          <button className="btn btn--secondary" onClick={handleCopyScript}>
            {copyState === "copied" ? "Copied!" : "Copy script"}
          </button>
          {copyState === "copied" && <span className="hint">Script copied to your clipboard.</span>}
          {copyState === "failed" && (
            <span className="hint hint--warn">
              Your browser blocked the clipboard — select the script below and copy it manually.
            </span>
          )}
        </div>
        {copyState === "failed" && (
          <pre className="script-block">{consoleScript}</pre>
        )}
      </section>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel} disabled={submitting}>
          Close
        </button>
      </div>
    </div>
  );
}
