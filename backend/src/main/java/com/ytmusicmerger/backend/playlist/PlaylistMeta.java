package com.ytmusicmerger.backend.playlist;

/** Lightweight playlist metadata (id/title/itemCount), used in merge/dedupe plan responses. */
public record PlaylistMeta(String id, String title, long itemCount) {
}
