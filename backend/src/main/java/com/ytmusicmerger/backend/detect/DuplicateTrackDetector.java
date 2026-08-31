package com.ytmusicmerger.backend.detect;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * §4 Duplicate-Track Detection. Pure function:
 * {@code List<TrackInput> -> { exact: List<ExactGroup>, possible: List<PossibleGroup> }}.
 * No Spring / Google API dependencies - trivially unit testable, runs both within a single
 * playlist (standalone dedupe) and across the union of source playlists (merge preview).
 */
public final class DuplicateTrackDetector {

    /** Title-similarity threshold for a "possible duplicate" match. */
    public static final double TITLE_THRESHOLD = 0.90;
    /** Channel-title-similarity threshold (used when channelId differs). */
    public static final double CHANNEL_THRESHOLD = 0.90;

    public record TrackInput(String playlistId, String playlistItemId, String videoId, String title,
                              String channelId, String channelTitle) {
    }

    /** Items sharing the same exact {@code videoId}. */
    public record ExactGroup(String videoId, List<TrackInput> items) {
    }

    /** Items connected by fuzzy title+channel similarity (different videoIds). */
    public record PossibleGroup(List<TrackInput> items, double similarity) {
    }

    public record Result(List<ExactGroup> exact, List<PossibleGroup> possible) {
    }

    public Result detect(List<TrackInput> items) {
        List<ExactGroup> exactGroups = detectExact(items);

        // Items already covered by an exact-videoId duplicate are excluded from fuzzy
        // matching - they're already unambiguously flagged.
        java.util.Set<TrackInput> exactCovered = new java.util.HashSet<>();
        for (ExactGroup g : exactGroups) {
            exactCovered.addAll(g.items());
        }
        List<TrackInput> fuzzyCandidates = new ArrayList<>();
        for (TrackInput t : items) {
            if (!exactCovered.contains(t)) {
                fuzzyCandidates.add(t);
            }
        }
        List<PossibleGroup> possibleGroups = detectPossible(fuzzyCandidates);

        return new Result(exactGroups, possibleGroups);
    }

    private List<ExactGroup> detectExact(List<TrackInput> items) {
        Map<String, List<TrackInput>> byVideoId = new LinkedHashMap<>();
        for (TrackInput t : items) {
            byVideoId.computeIfAbsent(t.videoId(), k -> new ArrayList<>()).add(t);
        }
        List<ExactGroup> groups = new ArrayList<>();
        for (Map.Entry<String, List<TrackInput>> e : byVideoId.entrySet()) {
            if (e.getValue().size() >= 2) {
                groups.add(new ExactGroup(e.getKey(), List.copyOf(e.getValue())));
            }
        }
        return groups;
    }

    private List<PossibleGroup> detectPossible(List<TrackInput> items) {
        int n = items.size();
        if (n < 2) {
            return List.of();
        }
        String[] normTitle = new String[n];
        String[] normChannel = new String[n];
        for (int i = 0; i < n; i++) {
            normTitle[i] = TextNormalizer.normalizeTrackTitle(items.get(i).title());
            normChannel[i] = TextNormalizer.normalizeChannelTitle(items.get(i).channelTitle());
        }

        double[][] titleSim = new double[n][n];
        UnionFind uf = new UnionFind(n);
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                TrackInput a = items.get(i);
                TrackInput b = items.get(j);
                if (a.videoId() != null && a.videoId().equals(b.videoId())) {
                    continue; // same video - not a "possible" (fuzzy) duplicate
                }
                double tSim = SimilarityUtil.jaroWinkler(normTitle[i], normTitle[j]);
                titleSim[i][j] = tSim;
                titleSim[j][i] = tSim;
                if (tSim < TITLE_THRESHOLD) {
                    continue;
                }
                boolean channelMatch;
                if (a.channelId() != null && a.channelId().equals(b.channelId())) {
                    channelMatch = true;
                } else {
                    double cSim = SimilarityUtil.jaroWinkler(normChannel[i], normChannel[j]);
                    channelMatch = cSim >= CHANNEL_THRESHOLD;
                }
                if (channelMatch) {
                    uf.union(i, j);
                }
            }
        }

        Map<Integer, List<Integer>> components = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            components.computeIfAbsent(uf.find(i), k -> new ArrayList<>()).add(i);
        }

        List<PossibleGroup> groups = new ArrayList<>();
        for (List<Integer> members : components.values()) {
            if (members.size() < 2) {
                continue;
            }
            double minSim = 1.0;
            for (int a = 0; a < members.size(); a++) {
                for (int b = a + 1; b < members.size(); b++) {
                    int i = members.get(a);
                    int j = members.get(b);
                    double s = titleSim[i][j];
                    if (s > 0) { // 0 means "not directly compared" (e.g. same videoId skip); recompute
                        minSim = Math.min(minSim, s);
                    } else {
                        double recomputed = SimilarityUtil.jaroWinkler(normTitle[i], normTitle[j]);
                        minSim = Math.min(minSim, recomputed);
                    }
                }
            }
            List<TrackInput> groupItems = new ArrayList<>();
            for (int idx : members) {
                groupItems.add(items.get(idx));
            }
            groups.add(new PossibleGroup(List.copyOf(groupItems), minSim));
        }
        return groups;
    }

    private static final class UnionFind {
        private final int[] parent;
        private final int[] rank;

        UnionFind(int n) {
            parent = new int[n];
            rank = new int[n];
            for (int i = 0; i < n; i++) {
                parent[i] = i;
            }
        }

        int find(int x) {
            while (parent[x] != x) {
                parent[x] = parent[parent[x]];
                x = parent[x];
            }
            return x;
        }

        void union(int a, int b) {
            int ra = find(a);
            int rb = find(b);
            if (ra == rb) {
                return;
            }
            if (rank[ra] < rank[rb]) {
                int tmp = ra;
                ra = rb;
                rb = tmp;
            }
            parent[rb] = ra;
            if (rank[ra] == rank[rb]) {
                rank[ra]++;
            }
        }
    }
}
