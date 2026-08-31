import { useState } from "react";
import { ErrorBanners } from "./components/ErrorBanner";
import { LoginGate } from "./components/LoginGate";
import { PlaylistsPage } from "./components/PlaylistsPage";
import { ErrorProvider } from "./context/ErrorContext";

export default function App() {
  // Bumping this remounts LoginGate, forcing a fresh GET /api/auth/status check
  // (used after logout, and after the OAuth redirect brings the browser back here).
  const [sessionEpoch, setSessionEpoch] = useState(0);

  return (
    <ErrorProvider>
      <ErrorBanners />
      <LoginGate key={sessionEpoch}>
        {(status) => (
          <PlaylistsPage
            channelTitle={status.channelTitle}
            onLoggedOut={() => setSessionEpoch((e) => e + 1)}
          />
        )}
      </LoginGate>
    </ErrorProvider>
  );
}
