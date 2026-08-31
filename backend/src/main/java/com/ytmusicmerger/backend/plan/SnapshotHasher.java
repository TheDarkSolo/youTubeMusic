package com.ytmusicmerger.backend.plan;

import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;

/**
 * §5.11 staleness check: hashes a deterministic snapshot of (playlistId, playlistItemId,
 * videoId) tuples across every playlist referenced by a plan, so a later re-fetch can be
 * compared to detect out-of-band changes (e.g. edits made on a phone between preview and
 * execute).
 */
public final class SnapshotHasher {

    private SnapshotHasher() {
    }

    public static String hash(List<PlaylistItemRecord> items) {
        List<String> tuples = new ArrayList<>();
        for (PlaylistItemRecord item : items) {
            tuples.add(item.playlistId() + "|" + item.playlistItemId() + "|" + item.videoId());
        }
        tuples.sort(String::compareTo);
        String joined = String.join("\n", tuples);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(joined.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
