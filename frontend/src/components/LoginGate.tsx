import { useEffect, useState } from "react";
import { api, authLoginUrl } from "../api/client";
import type { AuthStatus } from "../api/types";
import { useErrors } from "../context/ErrorContext";
import { Spinner } from "./Spinner";

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
      <div className="center-page">
        <div className="login-card">
          <h1>YT Music Manager</h1>
          <p>Connect your YouTube account to find and merge duplicate playlists.</p>
          <button
            className="btn btn--primary"
            onClick={() => {
              window.location.href = authLoginUrl;
            }}
          >
            Connect YouTube account
          </button>
        </div>
      </div>
    );
  }

  return <>{children({ channelTitle: status.channelTitle })}</>;
}
