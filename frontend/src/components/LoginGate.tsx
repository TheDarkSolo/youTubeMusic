import { useEffect, useState } from "react";
import { api, authLoginUrl } from "../api/client";
import type { AuthStatus } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Logo } from "./Logo";
import { Spinner } from "./Spinner";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  /** Rendered once the session is confirmed authenticated. */
  children: (status: { channelTitle?: string }) => React.ReactNode;
}

/**
 * Gate per docs/ARCHITECTURE.md §2:
 * 1. GET /api/auth/status on mount.
 * 2. If not authenticated, show a button that does a full page nav to
 *    /api/auth/login (never fetch — the backend needs a real browser redirect
 *    chain to Google and back).
 * 3. After the OAuth round trip the backend 302s back to FRONTEND_BASE_URL,
 *    so this component re-mounts fresh and re-checks status.
 */
export function LoginGate({ children }: Props) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const { reportError } = useErrors();

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    api
      .getAuthStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        if (!cancelled) reportError(err);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  if (checking) {
    return (
      <div className="center-page">
        <Spinner label="Checking sign-in status…" />
      </div>
    );
  }

  if (!status?.authenticated) {
    return (
      <div className="landing">
        <div className="theme-toggle-corner">
          <ThemeToggle />
        </div>
        <div className="landing__grid">
          <div className="landing__hero">
            <div className="landing__eyebrow">
              <Logo size={20} />
              <span>YT Music Manager</span>
            </div>
            <h1 className="landing__headline">
              Stop scrolling past the same playlist twice.
            </h1>
            <p className="landing__subhead">
              Finds duplicate playlists, flags duplicate tracks across your whole library, and
              helps you catch tracks up to Liked Music — always with a preview or a script you
              control, never a silent change.
            </p>
            <button
              className="btn btn--primary landing__cta"
              onClick={() => {
                window.location.href = authLoginUrl;
              }}
            >
              Connect YouTube account
            </button>
            <p className="landing__disclaimer hint">
              Free, no signup beyond Google sign-in. Nothing is stored beyond your current
              session.
            </p>
          </div>
          <div className="landing__features">
            <div className="landing__feature-card">
              <span className="landing__feature-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <rect x="7" y="10" width="14" height="10" rx="2.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.6" />
                  <polygon points="12.5,13.2 12.5,17 16,15.1" fill="currentColor" />
                </svg>
              </span>
              <h3>Merge duplicate playlists</h3>
              <p>
                Imported your library twice with a tool like TuneMyMusic and ended up with two
                copies of the same playlist? We detect the pairs, build a merge plan, and let you
                preview it before anything is combined.
              </p>
            </div>
            <div className="landing__feature-card">
              <span className="landing__feature-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="14" height="3" rx="1.2" fill="currentColor" />
                  <rect x="3" y="9" width="10" height="3" rx="1.2" fill="currentColor" fillOpacity="0.7" />
                  <rect x="3" y="14" width="6" height="3" rx="1.2" fill="currentColor" fillOpacity="0.45" />
                  <circle cx="17" cy="17" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <line x1="19.4" y1="19.4" x2="21.5" y2="21.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <h3>Scan your whole library</h3>
              <p>
                One read-only report ranks every playlist in your library by how many duplicate
                tracks it has, so you can see where cleanup is needed most — then jump straight
                into a playlist to review and remove them.
              </p>
            </div>
            <div className="landing__feature-card">
              <span className="landing__feature-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 20.2C6.7 16.6 3 13.2 3 9.4 3 6.4 5.4 4 8.4 4c1.7 0 3.3.8 4.4 2.2C13.9 4.8 15.5 4 17.2 4c3 0 5.4 2.4 5.4 5.4 0 3.8-3.7 7.2-9 10.8L12 20.2z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <h3>Add tracks to Liked Music</h3>
              <p>
                Finds every track in a playlist that isn't in your Liked Music yet, then gives
                you a one-click script to paste into your browser's console on the YouTube Music
                page — no API quota burned, even on large playlists.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children({ channelTitle: status.channelTitle })}</>;
}
