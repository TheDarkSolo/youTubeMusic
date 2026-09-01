import type {
  ApiErrorBody,
  AuthStatus,
  DedupeExecuteRequest,
  DedupeExecuteResponse,
  DedupePreviewRequest,
  DedupePreviewResponse,
  DeletePlaylistResponse,
  MergeExecuteRequest,
  MergeExecuteResponse,
  MergePreviewRequest,
  MergePreviewResponse,
  PlaylistTracksResponse,
  PlaylistsResponse,
} from "./types";

// Backend base URL — build-time config only, never a secret (see docs/ARCHITECTURE.md §6).
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/** Full-page navigation target for §2 step 1 — never fetch this, assign window.location.href. */
export const authLoginUrl = `${API_BASE_URL}/api/auth/login`;

/** Uniform error shape thrown for every non-2xx response, per §5.7. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // fetch itself threw — backend unreachable, CORS misconfig, offline, etc.
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the backend. Is it running at " + API_BASE_URL + "?",
      true,
    );
  }

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // response had no/invalid JSON body — fall through to generic message
    }
    const err = body?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN_ERROR",
      err?.message ?? `Request failed with status ${res.status}`,
      err?.retryable ?? false,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  getAuthStatus: () => request<AuthStatus>("/api/auth/status"),

  logout: () => request<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" }),

  getPlaylists: () => request<PlaylistsResponse>("/api/playlists"),

  getPlaylistTracks: (playlistId: string, pageToken?: string) => {
    const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
    return request<PlaylistTracksResponse>(
      `/api/playlists/${encodeURIComponent(playlistId)}/tracks${qs}`,
    );
  },

  mergePreview: (body: MergePreviewRequest) =>
    request<MergePreviewResponse>("/api/merge/preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  mergeExecute: (body: MergeExecuteRequest) =>
    request<MergeExecuteResponse>("/api/merge/execute", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  dedupePreview: (body: DedupePreviewRequest) =>
    request<DedupePreviewResponse>("/api/dedupe/preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  dedupeExecute: (body: DedupeExecuteRequest) =>
    request<DedupeExecuteResponse>("/api/dedupe/execute", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deletePlaylist: (playlistId: string) =>
    request<DeletePlaylistResponse>(`/api/playlists/${encodeURIComponent(playlistId)}`, {
      method: "DELETE",
    }),
};
