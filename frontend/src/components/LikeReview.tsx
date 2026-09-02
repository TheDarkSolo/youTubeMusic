import { useEffect, useState } from "react";
import type { LikePreviewResponse } from "../api/types";
import { buildLikeAllScript } from "../lib/likeAllScript";

interface Props {
  preview: LikePreviewResponse;
  playlistTitle: string;
  onCancel: () => void;
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
 * §5.13 — shows how many tracks a playlist would add to Liked Music, and hands over the
 * browser-console script that does it.
 *
 * There used to be a second route here that did the liking through the app itself via
 * `videos.rate` (§5.14). It worked, but at 50 quota units per track a large playlist could
 * not finish in a day, while the console script does the same job in one pass for free — so
 * the API route is no longer offered. The endpoint and `api.likeAll` client method are still
 * in place if it's ever wanted back.
 */
export function LikeReview({ preview, playlistTitle, onCancel }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

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

      <section className="like-route like-route--free">
        <h3 className="like-route__title">Run a script in your browser</h3>
        <p className="hint">
          This runs in your own browser on the YouTube Music page and takes{" "}
          {roughRuntime(preview.toLike)}. Leave that tab open while it works.
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
          <button className="btn btn--primary" onClick={handleCopyScript}>
            {copyState === "copied" ? "Copied!" : "Copy script"}
          </button>
          {copyState === "copied" && <span className="hint">Script copied to your clipboard.</span>}
          {copyState === "failed" && (
            <span className="hint hint--warn">
              Your browser blocked the clipboard — select the script below and copy it manually.
            </span>
          )}
        </div>
        {copyState === "failed" && <pre className="script-block">{consoleScript}</pre>}
      </section>

      <div className="modal__actions">
        <button className="btn btn--tertiary" onClick={onCancel}>
          Close
        </button>
      </div>
    </div>
  );
}
