# YT Music Manager — Architecture & API Contract

Status: authoritative contract for backend (`java-backend` agent) and frontend (`react-frontend` agent). Both must build against this document; any change here must be called out explicitly since the two sides are implemented independently.

This is a **personal-use, single-user, local-run tool** — not a multi-tenant SaaS. Simplicity is favored over generality throughout: in-memory state, no database, no multi-user auth.

---

## 1. Component Diagram / Data Flow

```
┌─────────────┐        HTTPS (JSON, credentials: include)      ┌──────────────────────┐
│             │ ───────────────────────────────────────────▶  │                        │
│   Browser   │                                                 │  Spring Boot backend   │
│  (React SPA │ ◀───────────────────────────────────────────   │  (Java 17, Maven)      │
│   on Vite)  │        Set-Cookie: JSESSIONID (HttpOnly)        │  localhost:8080        │
│             │                                                 │                        │
└─────────────┘                                                 └───────────┬────────────┘
                                                                              │
                                                                  Google OAuth 2.0 (Auth Code)
                                                                  + YouTube Data API v3 calls
                                                                  (server-to-server, bearer token)
                                                                              │
                                                                              ▼
                                                                 ┌─────────────────────────┐
                                                                 │  Google OAuth / YouTube  │
                                                                 │  Data API v3             │
                                                                 └─────────────────────────┘
```

**Key rule: the frontend never sees an access token or refresh token.** The browser only ever holds an `HttpOnly` session cookie. All calls to Google's OAuth endpoints and to the YouTube Data API v3 are made server-side by the Spring Boot backend. The React app only talks to the backend's own REST API (`/api/**`), never directly to `googleapis.com`.

Layers inside the backend:

- **AuthController** — OAuth login/callback/status/logout (§2).
- **PlaylistService** — wraps `playlists.list`, `playlistItems.list`, `playlistItems.insert`, `playlistItems.delete`, `playlists.delete` behind a typed Java API, with quota/rate-limit error translation.
- **DuplicatePlaylistDetector** — pure function: `List<Playlist> → List<CandidateGroup>` (§3).
- **DuplicateTrackDetector** — pure function: `List<PlaylistItem> → { exact: [...], possible: [...] }` (§4).
- **MergePlanService** / **DedupePlanService** — build a plan (add/remove operations) from user-selected inputs, cache it server-side keyed by a `planToken` with a short TTL, and execute it only when the caller presents back that exact token (§5, replay protection).

Frontend (React + Vite) is a thin client: fetch playlists → render duplicate-group suggestions → let user pick a group + target → call preview → render the diff → user clicks "Confirm merge" → call execute with the plan token. No business logic (similarity scoring, plan building) lives in the frontend; it only renders what the backend computed, so the algorithm has one implementation.

Dev topology: Vite dev server on `http://localhost:5173`, Spring Boot on `http://localhost:8080`. Backend CORS is configured to allow origin `http://localhost:5173` with `Access-Control-Allow-Credentials: true`. No API path proxying is required, but the frontend must use `fetch(url, { credentials: "include" })` on every call.

---

## 2. OAuth 2.0 Flow

- **Flow type**: Authorization Code (server-side), not implicit, not PKCE-only SPA flow — because the backend, not the browser, must hold the token.
- **Scope**: `https://www.googleapis.com/auth/youtube`
  This is the read/write scope. `youtube.readonly` is insufficient because merging requires `playlistItems.insert`, `playlistItems.delete`, and `playlists.delete`. Do not request broader scopes (e.g. `youtube.force-ssl` is unnecessary; `youtube` alone covers all playlist/playlistItem operations).
- **Consent params**: `access_type=offline` + `prompt=consent` on the initial authorization request, so Google returns a `refresh_token` (only granted on first consent or when forced). Without this the access token expires in ~1 hour with no way to silently renew it.

### Token storage

Single-user local app → no database, no per-user table. Token pair (`access_token`, `refresh_token`, `expiresAt`) is held **in-memory only**, attached to the Spring `HttpSession`:

- A session-scoped `@Component` (`GoogleTokenHolder`) stores the token pair for the current session.
- Backend issues a standard `HttpOnly`, `SameSite=Lax` session cookie (`JSESSIONID`) to the browser on successful callback. Cookie is not `Secure` in local dev (plain HTTP on localhost); mark `Secure` if ever deployed behind HTTPS.
- On every outgoing YouTube API call, the backend checks `expiresAt`; if expired or within a 60s buffer, it silently refreshes using the stored `refresh_token` before proceeding.
- Nothing is persisted to disk. Restarting the backend process invalidates the session — the user just logs in again. This is an accepted tradeoff for simplicity.
- No token, encrypted or otherwise, is ever sent to or stored in the browser (not in `localStorage`, not in a JS-readable cookie).

### Flow steps

1. Frontend calls `GET /api/auth/status`. If `authenticated: false`, it shows a "Connect YouTube account" button that navigates the browser (full page nav, not fetch) to `GET /api/auth/login`.
2. Backend redirects (302) to Google's `accounts.google.com/o/oauth2/v2/auth` with `client_id`, `redirect_uri`, `scope`, `access_type=offline`, `prompt=consent`, and a random `state` value the backend stashes server-side (session) to check on callback (CSRF protection).
3. User consents on Google's page. Google redirects the browser to `GOOGLE_REDIRECT_URI` = `GET /api/auth/callback?code=...&state=...`.
4. Backend validates `state`, exchanges `code` for tokens server-side (`POST https://oauth2.googleapis.com/token`), stores the pair in the session's `GoogleTokenHolder`, then issues a 302 redirect to `FRONTEND_BASE_URL` (e.g. `http://localhost:5173/`).
5. Frontend (now on its own page) calls `GET /api/auth/status` again → `authenticated: true` → proceeds to load playlists.

---

## 3. Duplicate-Playlist Detection

Candidate groups only — **never auto-merged**. The endpoint that lists playlists (`GET /api/playlists`) annotates each playlist with the candidate group(s) it belongs to; the frontend presents groups for the user to accept, edit membership of, or dismiss.

### Normalization (per playlist title)

Applied before any comparison:

1. Unicode NFKC normalize.
2. Strip emoji / pictographic symbols (regex over emoji Unicode blocks) and decorative symbols (★, ♪, •, etc.).
3. Lowercase.
4. Strip punctuation except alphanumerics and spaces.
5. Collapse repeated whitespace, trim.

Example: `"🎵 Chill Music 2024!!"` → `"chill music 2024"`.

### Grouping algorithm

1. Compute the normalized form for every playlist.
2. Any two playlists whose normalized forms are **identical** → similarity `1.0` (exact match after normalization).
3. Otherwise, compute similarity as the average of:
   - **Jaro-Winkler** distance on the normalized strings (handles typos / minor edits, favors common prefixes).
   - **Token-sort ratio**: split into whitespace tokens, sort alphabetically, rejoin, compare with Levenshtein-based ratio (handles reordering, e.g. "Music Chill" vs "Chill Music").
4. Build a similarity graph: an edge exists between two playlists when combined similarity ≥ **0.85**. Connected components of this graph are the candidate groups (union-find over pairwise edges).
5. Each group is returned with:
   - `confidence`: the minimum pairwise similarity within the group (conservative — the weakest link).
   - `matchType`: `"exact"` if every pair in the group is normalized-identical, otherwise `"fuzzy"`.
6. Singleton playlists (no edge ≥ 0.85 to anything) are not part of any group.

This threshold deliberately catches lookalikes like `"Chill Music 2024"` vs `"Chill Music 2025"` (high token overlap, differ only in one token) as a **fuzzy, low-confidence** candidate — it is surfaced, not hidden, and not preselected as strongly as an exact match, but the final call is always the user's via the confirmation UI. The algorithm never deletes or merges anything by itself.

---

## 4. Duplicate-Track Detection

Runs (a) within a single playlist for the standalone dedupe feature, and (b) across the union of source playlists during a merge preview.

### Primary: exact `videoId` match

Two `playlistItem`s with the same `resourceId.videoId` are exact duplicates. This is unambiguous — same video, so same song/upload. These are the ones actually removed during a merge/dedupe **execute**, and are shown pre-selected in the preview.

### Secondary: fuzzy title + channel match ("possible duplicates")

Catches the same song uploaded as two different videos (e.g. official audio vs. official video, or two different uploaders). Never auto-selected for removal.

Normalization of `snippet.title` before comparison:

1. Lowercase, NFKC normalize.
2. Strip common noise tokens/parentheticals: `(official video)`, `(official audio)`, `(lyrics)`, `(audio)`, `[hd]`, `ft.`/`feat.` segments, `- topic` (YouTube auto-generated channel suffix), extra whitespace/punctuation.

Match condition (both must hold):

- Title similarity (Jaro-Winkler on normalized titles) ≥ **0.90**, AND
- Channel match: either `channelId` equal, OR normalized `channelTitle` similarity ≥ **0.90** (covers `"Artist"` vs `"Artist - Topic"` after the `- topic` strip, and minor channel-name variants).

Every such pair is returned in a separate `possibleDuplicates` list in the preview response, each requiring an explicit per-item checkbox/confirmation from the user before it is added to the removal set — it is never merged into the auto-selected exact-match removal list.

---

## 5. REST API Contract

Base path: `/api`. All responses `application/json`. All endpoints except `/auth/login` and `/auth/callback` require an authenticated session (`401` otherwise, see §5.7).

### 5.1 `GET /api/auth/login`

Redirects (302) the browser to Google's OAuth consent screen. No request/response body (browser navigation, not fetch).

### 5.2 `GET /api/auth/callback`

Google redirects here with `code` and `state` query params. Backend exchanges the code, stores tokens in-session, then 302-redirects the browser to `FRONTEND_BASE_URL`. No JSON response (browser navigation).

### 5.3 `GET /api/auth/status`

```jsonc
// 200 OK
{
  "authenticated": true,
  "channelTitle": "Anur Tore"
}
```
```jsonc
// 200 OK (not authenticated)
{ "authenticated": false }
```

### 5.4 `POST /api/auth/logout`

Clears the session's token holder and invalidates the HTTP session.

```jsonc
// 200 OK
{ "loggedOut": true }
```

### 5.5 `GET /api/playlists`

Lists the user's playlists with duplicate-group annotations.

```jsonc
// 200 OK
{
  "playlists": [
    {
      "id": "PLxxxxxxxxxxxxxxxxxx",
      "title": "Calm",
      "itemCount": 42,
      "thumbnailUrl": "https://...",
      "duplicateGroupId": "grp-1"
    },
    {
      "id": "PLyyyyyyyyyyyyyyyyyy",
      "title": "Calm (Imported)",
      "itemCount": 40,
      "thumbnailUrl": "https://...",
      "duplicateGroupId": "grp-1"
    },
    {
      "id": "PLzzzzzzzzzzzzzzzzzz",
      "title": "Workout Mix",
      "itemCount": 15,
      "thumbnailUrl": "https://...",
      "duplicateGroupId": null
    }
  ],
  "duplicateGroups": [
    {
      "id": "grp-1",
      "playlistIds": ["PLxxxxxxxxxxxxxxxxxx", "PLyyyyyyyyyyyyyyyyyy"],
      "confidence": 0.91,
      "matchType": "fuzzy"
    }
  ]
}
```

### 5.6 `GET /api/playlists/{playlistId}/tracks`

Query params: `pageToken` (optional, opaque cursor forwarded from YouTube API).

```jsonc
// 200 OK
{
  "playlistId": "PLxxxxxxxxxxxxxxxxxx",
  "items": [
    {
      "playlistItemId": "UExFxxxx...item1",
      "videoId": "dQw4w9WgXcQ",
      "title": "Song Title",
      "channelTitle": "Some Artist",
      "channelId": "UCxxxxxxxxxxxxxxxxxxxxxx",
      "thumbnailUrl": "https://..."
    }
  ],
  "nextPageToken": "CAUQAA"
}
```

### 5.7 Error response shape (applies to all endpoints)

```jsonc
// 401 — no/expired session, refresh failed
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "No active YouTube session. Please log in again.",
    "retryable": false
  }
}
```
```jsonc
// 403 — Google returned insufficient-permission / not the resource owner
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to modify this playlist.",
    "retryable": false
  }
}
```
```jsonc
// 429 — YouTube Data API quota exceeded
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "YouTube API daily quota exceeded. Try again after quota reset (midnight Pacific time).",
    "retryable": true
  }
}
```
```jsonc
// 409 — plan token stale (see §5.10)
{
  "error": {
    "code": "PLAN_STALE",
    "message": "The playlists changed since this plan was generated. Please re-run preview.",
    "retryable": true
  }
}
```
HTTP status always mirrors `error.code`'s natural status (401/403/404/409/429/500). `retryable: true` means the frontend may offer a "retry" action as-is (e.g. after a wait); `false` means the user must take a different action (re-auth, re-preview).

### 5.8 `POST /api/merge/preview`

Dry run — **no side effects**. Computes the plan to merge N source playlists into one target (existing playlist, or a new one to be created).

Request:
```jsonc
{
  "sourcePlaylistIds": ["PLxxxxxxxxxxxxxxxxxx", "PLyyyyyyyyyyyyyyyyyy"],
  "target": { "mode": "existing", "playlistId": "PLxxxxxxxxxxxxxxxxxx" }
  // OR: "target": { "mode": "create", "title": "Calm (Merged)" }
}
```

Response:
```jsonc
{
  "planToken": "6f2c1e8a-...-uuid",
  "expiresAt": "2026-08-31T21:15:00Z",
  "target": { "mode": "existing", "playlistId": "PLxxxxxxxxxxxxxxxxxx", "title": "Calm" },
  "sourcePlaylists": [
    { "playlistId": "PLxxxxxxxxxxxxxxxxxx", "title": "Calm", "itemCount": 42 },
    { "playlistId": "PLyyyyyyyyyyyyyyyyyy", "title": "Calm (Imported)", "itemCount": 40 }
  ],
  "plannedAdds": [
    { "videoId": "abc123", "title": "Song A", "fromPlaylistId": "PLyyyyyyyyyyyyyyyyyy" }
  ],
  "plannedRemovals": {
    "exact": [
      {
        "videoId": "dQw4w9WgXcQ",
        "title": "Song Title",
        "keep": { "playlistId": "PLxxxxxxxxxxxxxxxxxx", "playlistItemId": "UExFxxxx...keep" },
        "remove": [
          { "playlistId": "PLyyyyyyyyyyyyyyyyyy", "playlistItemId": "UExFxxxx...drop" }
        ]
      }
    ],
    "possibleDuplicates": [
      {
        "groupId": "pd-1",
        "similarity": 0.93,
        "items": [
          { "playlistId": "PLxxxxxxxxxxxxxxxxxx", "playlistItemId": "UExFxxxx...a", "videoId": "vid1", "title": "Song B (Official Audio)", "channelTitle": "Artist" },
          { "playlistId": "PLyyyyyyyyyyyyyyyyyy", "playlistItemId": "UExFxxxx...b", "videoId": "vid2", "title": "Song B", "channelTitle": "Artist - Topic" }
        ]
      }
    ]
  },
  "summary": { "toAdd": 40, "exactDuplicatesToRemove": 1, "possibleDuplicateGroups": 1 },
  "estimatedQuota": { "committedUnits": 2050, "maxAdditionalUnits": 50 }
}
```

Notes:
- `plannedRemovals.exact` is pre-selected by the algorithm — these are unambiguous. The UI shows them as checked/included by default but the user can still uncheck individual ones before executing.
- `estimatedQuota` — YouTube Data API v3 quota cost estimate for this plan, computed from the published per-call costs (`playlistItems.insert`/`delete` = 50 units each, `playlists.insert` = 50 units, list calls = 1 unit and are ignored as negligible). `committedUnits` is the cost of what's already selected by default: `(plannedAdds.length + exactDuplicatesToRemove) * 50`, plus `50` more if `target.mode === "create"`. `maxAdditionalUnits` is the *extra* cost if the user confirms every `possibleDuplicates` group: `sum(group.items.length - 1) * 50`. This exists purely to inform the user before they spend quota (the default daily cap is 10,000 units, and a single large merge can consume most of it) — it does not gate or block execute in any way, and the frontend may recompute a live version of `committedUnits` locally as the user toggles exact-removal checkboxes, since it's a pure function of already-known counts.
- `plannedRemovals.possibleDuplicates` items are **never** pre-selected. The execute request must carry the user's explicit choices (§5.9).
- Within each `possibleDuplicates` group, `items[0]` is the one that survives on execute (the rest are deleted) — same "keep" preference as exact groups (§5.8 above): the item already residing in the merge target, if the group has one, otherwise the first-encountered item. This matters because it determines whether confirming a group keeps the user's existing target-playlist track or the newly-merged-in one.
- If `target.mode === "create"`, `target.playlistId` is omitted here (doesn't exist yet); `plannedAdds` covers *all* items from *all* source playlists in that case (nothing to dedupe against yet, other than dedupe among the sources themselves).
- `planToken` is a server-side cache key (in-memory `Map<planToken, PlanRecord>` with TTL, e.g. 5 minutes) capturing the exact plan **and** a snapshot hash of source/target playlist contents at preview time. It carries no data the client needs to trust — the client always sends back the *selections*, and the server re-derives the actual operations from its own cached `PlanRecord`, never from client-supplied item lists.

### 5.9 `POST /api/merge/execute`

Actually performs the merge. Requires the `planToken` from a prior preview to avoid acting on stale/hallucinated plans (see §5.11 for replay/staleness handling).

Request:
```jsonc
{
  "planToken": "6f2c1e8a-...-uuid",
  "confirmedPossibleDuplicateGroupIds": ["pd-1"],
  // ^ groupIds from plannedRemovals.possibleDuplicates that the user explicitly checked;
  //   any group not listed here is left untouched (both items kept).
  "excludedExactVideoIds": ["dQw4w9WgXcQ"]
  // ^ optional. videoIds from plannedRemovals.exact that the user unchecked (§5.8 note:
  //   exact removals are pre-selected but the user can still opt a specific one out before
  //   confirming). Omit or send [] to remove all exact duplicates as planned. Any videoId
  //   here that isn't in the cached plan's plannedRemovals.exact is ignored.
}
```

Response:
```jsonc
{
  "status": "completed",
  "target": { "playlistId": "PLxxxxxxxxxxxxxxxxxx", "title": "Calm" },
  "added": 40,
  "removedExact": 1,
  "removedConfirmedPossible": 1,
  "sourcePlaylistsDeleted": [],
  "errors": []
}
```
- Executing does **not** delete the emptied source playlists automatically. A separate, explicit follow-up action (out of scope for v1, or a future `deleteSourcePlaylists: true` flag on this same request — left as a possible extension, not built now) would be required, since `playlists.delete` is destructive and irreversible.
- `errors` is a list of per-item failures (e.g. one `playlistItems.insert` call failed) so a partial success is still reported clearly rather than silently swallowed; overall `status` becomes `"partial"` if `errors` is non-empty.

### 5.10 `POST /api/dedupe/preview`

Standalone single-playlist dedupe (no merge). Request:
```jsonc
{ "playlistId": "PLxxxxxxxxxxxxxxxxxx" }
```
Response: same shape as `plannedRemovals` in §5.8, wrapped with a `planToken`:
```jsonc
{
  "planToken": "9a1b...-uuid",
  "expiresAt": "2026-08-31T21:15:00Z",
  "playlistId": "PLxxxxxxxxxxxxxxxxxx",
  "removals": {
    "exact": [ /* same shape as §5.8 plannedRemovals.exact */ ],
    "possibleDuplicates": [ /* same shape as §5.8 plannedRemovals.possibleDuplicates */ ]
  },
  "summary": { "exactDuplicatesToRemove": 3, "possibleDuplicateGroups": 2 },
  "estimatedQuota": { "committedUnits": 150, "maxAdditionalUnits": 100 }
}
```
`estimatedQuota` follows the same shape and computation as §5.8's (no `plannedAdds`/`target` here, so `committedUnits = exactDuplicatesToRemove * 50`, `maxAdditionalUnits = sum(group.items.length - 1) * 50` over `possibleDuplicates`).

### 5.11 `POST /api/dedupe/execute`

```jsonc
{
  "planToken": "9a1b...-uuid",
  "confirmedPossibleDuplicateGroupIds": ["pd-2"],
  "excludedExactVideoIds": []
  // ^ optional, same semantics as §5.9.
}
```
```jsonc
// 200 OK
{ "status": "completed", "playlistId": "PLxxxxxxxxxxxxxxxxxx", "removedExact": 3, "removedConfirmedPossible": 1, "errors": [] }
```

### Plan token / staleness rules (applies to both execute endpoints)

- `planToken` is opaque, single-use conceptually: on execute, the server looks it up, and if found, **deletes it from the cache immediately** (whether execute succeeds or fails) — one preview yields at most one execute attempt. A second execute with the same token gets `404 PLAN_NOT_FOUND`.
- If the token is missing/expired (TTL passed) → `404`:
  ```jsonc
  { "error": { "code": "PLAN_NOT_FOUND", "message": "Plan expired or already used. Please re-run preview.", "retryable": true } }
  ```
- Before applying operations, the server re-fetches current `playlistItems` for every playlist referenced in the plan and compares against the snapshot hash stored with the `PlanRecord`. If they differ (user changed something in YouTube Music directly, e.g. on their phone, between preview and execute) → `409 PLAN_STALE` (§5.7), plan is discarded, no partial writes are attempted.

### 5.12 `DELETE /api/playlists/{playlistId}`

Deletes a playlist outright (`playlists.delete`). This is the "later iteration" flagged as a non-goal in §7 of earlier drafts — merge/dedupe leave emptied source playlists in place, and this endpoint is how the user cleans them up afterward, as a separate deliberate action.

No plan-token/preview step: unlike merge/dedupe there is nothing to diff or partially apply — deleting one playlist by id is atomic and has no "what will change" ambiguity to preview. Explicit confirmation instead happens client-side (the frontend must show a confirmation dialog naming the playlist and its track count before calling this endpoint) — this satisfies the same "no destructive action without explicit user confirmation" rule the rest of the API follows, just via a simpler mechanism appropriate to a single atomic operation.

```jsonc
// 200 OK
{ "deleted": true, "playlistId": "PLxxxxxxxxxxxxxxxxxx" }
```

Errors follow §5.7 (404 if the playlist doesn't exist or isn't owned by the user, 403/401/429 as usual).

**Frontend gating**: the "Delete playlist" action is only surfaced for a playlist that is a member of a detected duplicate group (§3) *and* has strictly fewer tracks (`itemCount`) than the group's largest member — i.e. it's presented as cleanup for the "losing" side of a duplicate pair, not as a general-purpose delete-any-playlist button. Singleton playlists (no `duplicateGroupId`) never show this action.

### 5.13 `GET /api/playlists/{playlistId}/like-preview`

Motivation: a playlist imported from another service (e.g. a Spotify "Liked Songs" export via TuneMyMusic) lands in YouTube Music as an ordinary playlist, not merged into the account's native "Liked Music" auto-playlist. This lets the user bulk-like every track in a chosen playlist so it starts showing up in Liked Music, instead of liking each track by hand.

Read-only, no side effects: fetches the playlist's current tracks and checks the caller's existing rating for each unique `videoId` (`videos.getRating`, batchable up to 50 ids per call, 1 unit each) to determine how many are **not yet liked** - that's the actual quota-costing work `like-all` would do, since `videos.rate` is a 50-unit write call and re-liking an already-liked video is wasted quota.

```jsonc
// 200 OK
{
  "playlistId": "PLxxxxxxxxxxxxxxxxxx",
  "totalTracks": 793,
  "alreadyLiked": 40,
  "toLike": 753,
  "estimatedQuota": { "committedUnits": 37650 }
}
```
`estimatedQuota.committedUnits = toLike * 50`, same computation style as §5.8/§5.10.

### 5.14 `POST /api/playlists/{playlistId}/like-all`

Executes the like-all action. No plan-token/staleness machinery (unlike merge/dedupe): liking is idempotent and non-destructive - re-fetching the playlist's current tracks and rating status fresh at execute time (rather than trusting a cached preview snapshot) carries no hazard, since there's no "wrong item got deleted" failure mode here, only "liked slightly more or fewer tracks than the preview showed" if the playlist changed in between, which is harmless.

For every currently-unliked unique `videoId` in the playlist: `videos.rate(id, rating="like")`.

```jsonc
// 200 OK
{ "status": "completed", "liked": 753, "alreadyLiked": 40, "errors": [] }
```
`status` becomes `"partial"` if `errors` is non-empty, same convention as merge/dedupe execute responses.

Errors follow §5.7. Both endpoints require the existing `https://www.googleapis.com/auth/youtube` OAuth scope (§2) - `videos.rate`/`videos.getRating` are covered by it, no re-consent needed.

**Frontend**: unlike delete-playlist, "Add to Liked Music" is a general-purpose action available on *every* playlist card (duplicate-group members and singles alike) - it's not duplicate-cleanup-specific. Clicking it calls like-preview and shows a confirmation dialog with the track count and quota estimate (reusing the same warn-styling threshold as merge/dedupe's quota display) before the user confirms and `like-all` is called.

**Known caveat**: YouTube's `contentDetails.itemCount` (used for both the number shown on playlist cards and the "fewer tracks" comparison above) can lag behind the playlist's actual contents — observed in practice as a playlist showing `itemCount: 1` in this app while YouTube Music's own UI shows 0 tracks for the same playlist. This is a caching quirk on YouTube's side, not something this app's read path gets wrong (the same `playlists.list.contentDetails.itemCount` field YouTube Music's own UI would also ultimately derive from, just resolved at different times). No fix is applied for this in v1; the existing "Show tracks" action (§5.6, a live `playlistItems.list` call) is the accurate real-time source of truth if the user wants to double-check before deleting.

---

## 6. Backend Environment Variables

Required, backend-only (never exposed to the frontend):

| Variable | Description | Example |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Must exactly match a redirect URI registered in Google Cloud Console | `http://localhost:8080/api/auth/callback` |
| `FRONTEND_BASE_URL` | Where to send the browser after callback, and the allowed CORS origin | `http://localhost:5173` |

Optional:

| Variable | Description | Default |
|---|---|---|
| `SERVER_PORT` | Backend port | `8080` |

These belong in `backend/src/main/resources/application-local.yml` (already gitignored — see repo `.gitignore`), activated locally via `SPRING_PROFILES_ACTIVE=local`. The backend agent must commit `backend/src/main/resources/application-local.yml.example` with placeholder values and instructions, so the real file is never checked in.

The frontend needs no secrets — its only build-time config is the backend base URL (e.g. `VITE_API_BASE_URL=http://localhost:8080`), which is not sensitive and can live in a committed `frontend/.env.example` / local `frontend/.env` (already covered by the repo's Node section in `.gitignore` if added there).

---

## 7. Explicit non-goals (v1)

- No database / persistence layer — all detection runs live against fresh YouTube API data each time.
- No multi-user auth, no account system beyond the single Google login.
- No automatic deletion of emptied source playlists after a merge (manual, separate action, left for a later iteration).
- No background jobs / scheduling — every action is user-initiated and synchronous from the browser's perspective.
