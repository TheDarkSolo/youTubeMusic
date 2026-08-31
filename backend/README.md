# Backend - YT Music Playlist Merger

Java 17 + Spring Boot (Maven) backend implementing the API contract in
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md): Google OAuth 2.0 login, YouTube Data API v3
playlist/track listing, duplicate-playlist and duplicate-track detection, and merge/dedupe
preview+execute with a server-side plan-token cache.

This is a personal-use, single-user, local-run tool - no database, all state in-memory.

## 1. Get Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create (or select)
   a project.
2. **APIs & Services > Library** - search for **"YouTube Data API v3"** and click **Enable**.
3. **APIs & Services > OAuth consent screen** - configure it if you haven't already (choose
   **External**, add yourself as a test user - the app doesn't need to be published for
   personal use).
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs**: add exactly the URI you'll use for
     `GOOGLE_REDIRECT_URI` below, e.g. `http://localhost:8080/api/auth/callback`.
5. Copy the generated **Client ID** and **Client secret** - you'll need them below.

## 2. Configure environment variables

Required:

| Variable | Description | Example |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from step 1 | `123-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret from step 1 | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Must exactly match the redirect URI registered in step 4 | `http://localhost:8080/api/auth/callback` |
| `FRONTEND_BASE_URL` | Where the browser is sent after login, and the allowed CORS origin | `http://localhost:5173` |

Optional:

| Variable | Description | Default |
|---|---|---|
| `SERVER_PORT` | Backend port | `8080` |

You have two ways to provide these:

**Option A - plain environment variables:**

```bash
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
export GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/callback
export FRONTEND_BASE_URL=http://localhost:5173
mvn spring-boot:run
```

**Option B - local profile file (recommended for repeated local runs):**

```bash
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
# edit application-local.yml and fill in the real values
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```

`application-local.yml` is already covered by the repo's `.gitignore` - it will never be
committed. Only the `.example` file (with placeholders) is tracked in git. Real credentials
must never be hardcoded anywhere in the source.

## 3. Run

```bash
cd backend
SPRING_PROFILES_ACTIVE=local mvn spring-boot:run
```

The backend starts on `http://localhost:8080` (or `$SERVER_PORT`). It expects the frontend
(Vite dev server) to be running at `FRONTEND_BASE_URL` and to call every `/api/**` endpoint
with `fetch(url, { credentials: "include" })`, since auth state lives in an `HttpOnly` session
cookie, never in a token the browser can read.

## 4. Run tests

```bash
mvn test
```

Unit tests cover `DuplicatePlaylistDetector` (§3) and `DuplicateTrackDetector` (§4) - pure,
dependency-free classes with no live API calls. No Google credentials are needed to run the
test suite.

## Project layout

```
src/main/java/com/ytmusicmerger/backend/
  auth/       AuthController, GoogleTokenHolder (session-scoped token store), GoogleOAuthClient, AuthService
  playlist/   PlaylistController, PlaylistService (playlists.list / playlistItems.list wrapper)
  detect/     DuplicatePlaylistDetector, DuplicateTrackDetector, TextNormalizer, SimilarityUtil
              (pure, no Spring/API dependencies - §3/§4 algorithms)
  plan/       PlanCache (shared plan-token TTL cache), SnapshotHasher (staleness check),
              RemovalPlanBuilder (bridges detectors to keep/remove plans), shared response DTOs
  merge/      MergeController, MergePlanService, MergePlanRecord, request/response DTOs
  dedupe/     DedupeController, DedupePlanService, DedupePlanRecord, request/response DTOs
  youtube/    YouTubeClientFactory, ThumbnailUtil
  config/     CorsConfig, GoogleOAuthProperties, AppProperties, GoogleClientsConfig, DetectorConfig
  error/      ApiException, ErrorCode, ErrorResponse, GlobalExceptionHandler (§5.7 uniform errors)
```
