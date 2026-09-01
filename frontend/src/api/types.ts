// Types mirroring the JSON shapes in docs/ARCHITECTURE.md §5.
// Kept 1:1 with the contract so the API client stays a thin, typed wrapper.

export interface AuthStatus {
  authenticated: boolean;
  channelTitle?: string;
}

export interface Playlist {
  id: string;
  title: string;
  itemCount: number;
  thumbnailUrl: string;
  duplicateGroupId: string | null;
}

export type MatchType = "exact" | "fuzzy";

export interface DuplicateGroup {
  id: string;
  playlistIds: string[];
  confidence: number;
  matchType: MatchType;
}

export interface PlaylistsResponse {
  playlists: Playlist[];
  duplicateGroups: DuplicateGroup[];
}

export interface PlaylistTrackItem {
  playlistItemId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
}

export interface PlaylistTracksResponse {
  playlistId: string;
  items: PlaylistTrackItem[];
  nextPageToken?: string;
}

// §5.7 uniform error envelope
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "QUOTA_EXCEEDED"
  | "PLAN_STALE"
  | "PLAN_NOT_FOUND"
  | "NOT_FOUND"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR"
  | string;

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
  };
}

export type MergeTarget =
  | { mode: "existing"; playlistId: string }
  | { mode: "create"; title: string };

export interface MergePreviewRequest {
  sourcePlaylistIds: string[];
  target: MergeTarget;
}

export interface PlannedAdd {
  videoId: string;
  title: string;
  fromPlaylistId: string;
}

export interface PlaylistItemRef {
  playlistId: string;
  playlistItemId: string;
}

export interface ExactRemoval {
  videoId: string;
  title: string;
  keep: PlaylistItemRef;
  remove: PlaylistItemRef[];
}

export interface PossibleDuplicateItem {
  playlistId: string;
  playlistItemId: string;
  videoId: string;
  title: string;
  channelTitle: string;
}

export interface PossibleDuplicateGroup {
  groupId: string;
  similarity: number;
  items: PossibleDuplicateItem[];
}

export interface PlannedRemovals {
  exact: ExactRemoval[];
  possibleDuplicates: PossibleDuplicateGroup[];
}

// §5.8/§5.10 — YouTube Data API v3 quota cost estimate for a preview's plan.
// committedUnits: cost of what's already selected by default.
// maxAdditionalUnits: extra cost if every possibleDuplicates group is confirmed.
export interface EstimatedQuota {
  committedUnits: number;
  maxAdditionalUnits: number;
}

export interface MergePreviewResponse {
  planToken: string;
  expiresAt: string;
  target: { mode: "existing" | "create"; playlistId?: string; title: string };
  sourcePlaylists: { playlistId: string; title: string; itemCount: number }[];
  plannedAdds: PlannedAdd[];
  plannedRemovals: PlannedRemovals;
  summary: {
    toAdd: number;
    exactDuplicatesToRemove: number;
    possibleDuplicateGroups: number;
  };
  estimatedQuota: EstimatedQuota;
}

export interface MergeExecuteRequest {
  planToken: string;
  confirmedPossibleDuplicateGroupIds: string[];
  excludedExactVideoIds?: string[];
}

/** §5.9/§5.11/§5.14 per-item execute failure - carries why a specific track failed. */
export interface ExecuteError {
  message: string;
  videoId: string;
  playlistId: string;
}

/**
 * §5.15 — outcome of an execute write loop.
 * "quota_exhausted": the loop hit the daily YouTube API quota and stopped at that item
 * rather than firing further doomed calls. The item that tripped the quota is NOT in
 * `errors`; it's represented by this status plus `remaining`.
 */
export type ExecuteStatus = "completed" | "partial" | "quota_exhausted";

export interface MergeExecuteResponse {
  status: ExecuteStatus;
  /** §5.15 — items left unattempted when the loop stopped. Always present, 0 otherwise. */
  remaining: number;
  target: { playlistId: string; title: string };
  added: number;
  removedExact: number;
  removedConfirmedPossible: number;
  sourcePlaylistsDeleted: string[];
  errors: ExecuteError[];
}

export interface DedupePreviewRequest {
  playlistId: string;
}

export interface DedupePreviewResponse {
  planToken: string;
  expiresAt: string;
  playlistId: string;
  removals: PlannedRemovals;
  summary: {
    exactDuplicatesToRemove: number;
    possibleDuplicateGroups: number;
  };
  estimatedQuota: EstimatedQuota;
}

export interface DedupeExecuteRequest {
  planToken: string;
  confirmedPossibleDuplicateGroupIds: string[];
  excludedExactVideoIds?: string[];
}

export interface DedupeExecuteResponse {
  status: ExecuteStatus;
  /** §5.15 — items left unattempted when the loop stopped. Always present, 0 otherwise. */
  remaining: number;
  playlistId: string;
  removedExact: number;
  removedConfirmedPossible: number;
  errors: ExecuteError[];
}

// §5.12
export interface DeletePlaylistResponse {
  deleted: boolean;
  playlistId: string;
}

// §5.13 — like-preview has no maxAdditionalUnits (no optional-confirm groups like merge/dedupe).
export interface LikeEstimatedQuota {
  committedUnits: number;
}

export interface LikePreviewResponse {
  playlistId: string;
  totalTracks: number;
  alreadyLiked: number;
  toLike: number;
  estimatedQuota: LikeEstimatedQuota;
}

// §5.14
export interface LikeAllResponse {
  status: ExecuteStatus;
  /** §5.15 — tracks left unattempted when the loop stopped. Always present, 0 otherwise. */
  remaining: number;
  liked: number;
  alreadyLiked: number;
  errors: ExecuteError[];
}
