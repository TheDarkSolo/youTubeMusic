# YT Music Playlist Merger — Frontend

React + Vite + TypeScript single-page app for the personal-use YouTube playlist
merger. Implements the client side of the contract in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md): login, playlist listing with
duplicate-group detection, merge preview/execute, and standalone dedupe
preview/execute.

This app is a thin client — it renders whatever the backend computes. All
similarity scoring and plan-building logic lives server-side.

## Install

```bash
npm install
```

## Configure

```bash
cp .env.example .env
```

`.env` sets `VITE_API_BASE_URL`, the base URL of the Spring Boot backend
(defaults to `http://localhost:8080`). This is build-time config only, not a
secret — it's fine for `.env.example` to be committed. `.env` itself is
gitignored at the repo root.

## Run

```bash
npm run dev
```

Starts the Vite dev server at `http://localhost:5173`. The app expects the
backend to already be running at the URL configured in `VITE_API_BASE_URL`
(`http://localhost:8080` by default), with CORS configured to allow
`http://localhost:5173` with credentials (already set up backend-side per the
architecture doc). All API calls use `fetch(..., { credentials: "include" })`
so the backend's `HttpOnly` session cookie is sent automatically — no token is
ever visible to or stored in the browser.

## Build

```bash
npm run build
```

Type-checks with `tsc -b` and produces a production build in `dist/`.

## Structure

- `src/api/client.ts` — thin fetch wrapper for every `/api/**` endpoint, typed
  request/response shapes per `docs/ARCHITECTURE.md` §5, plus an `ApiError`
  class for the uniform `{ error: { code, message, retryable } }` shape.
- `src/api/types.ts` — TypeScript types mirroring the JSON in the architecture
  doc.
- `src/components/` — `LoginGate` (OAuth gate), `PlaylistsPage` (main view),
  `DuplicateGroupCard`/`PlaylistCard` (listing), `MergeSetup`/`MergeReview`
  (merge flow), `DedupeReview` (standalone per-playlist dedupe), `Modal`,
  `Spinner`, `ErrorBanner`.
- `src/context/ErrorContext.tsx` — global dismissible error/toast banners and
  a short cooldown applied to retry-style actions after a `429
  QUOTA_EXCEEDED` response.

## Notes

Earlier drafts of `docs/ARCHITECTURE.md` had a gap where §5.8 promised the
user could uncheck individual exact-duplicate removals before executing, but
the execute request shape had no field for it. The doc was amended to add an
optional `excludedExactVideoIds` field to `POST /api/merge/execute` and
`POST /api/dedupe/execute`, and `MergeReview`/`DedupeReview` now send it.
