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

export interface MergeExecuteResponse {
  status: "completed" | "partial";
  target: { playlistId: string; title: string };
  added: number;
  removedExact: number;
  removedConfirmedPossible: number;
  sourcePlaylistsDeleted: string[];
  errors: unknown[];
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
  status: "completed" | "partial";
  playlistId: string;
  removedExact: number;
  removedConfirmedPossible: number;
  errors: unknown[];
}
