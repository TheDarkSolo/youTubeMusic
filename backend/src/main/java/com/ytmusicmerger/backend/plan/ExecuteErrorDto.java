package com.ytmusicmerger.backend.plan;

/**
 * §5.9/§5.11 per-item execute failure. Not fully specified by the architecture doc beyond
 * "a list of per-item failures" - shape chosen to give the frontend enough to render a
 * useful message (which video/playlist failed, and why).
 */
public record ExecuteErrorDto(String message, String videoId, String playlistId) {
}
