package com.ytmusicmerger.backend.detect;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * §3 Duplicate-Playlist Detection. Pure function: {@code List<PlaylistInput> -> List<CandidateGroup>}.
 * No Spring / Google API dependencies - trivially unit testable.
 */
public final class DuplicatePlaylistDetector {

    /** Similarity threshold for an edge in the grouping graph. */
    public static final double THRESHOLD = 0.85;

    public record PlaylistInput(String id, String title) {
    }

    public record CandidateGroup(String id, List<String> playlistIds, double confidence, String matchType) {
    }

    /**
     * Groups playlists whose combined title similarity is >= {@link #THRESHOLD} into
     * connected components (union-find over pairwise edges). Singleton playlists (no edge
     * to anything) are omitted from the result.
     */
    public List<CandidateGroup> detect(List<PlaylistInput> playlists) {
        int n = playlists.size();
        if (n < 2) {
            return List.of();
        }

        String[] normalized = new String[n];
        for (int i = 0; i < n; i++) {
            normalized[i] = TextNormalizer.normalizePlaylistTitle(playlists.get(i).title());
        }

        // Full pairwise similarity matrix - needed both for edge-building and later for
        // "minimum pairwise similarity within group" confidence + exact/fuzzy matchType.
        double[][] sim = new double[n][n];
        UnionFind uf = new UnionFind(n);
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                double s = SimilarityUtil.combinedTitleSimilarity(normalized[i], normalized[j]);
                sim[i][j] = s;
                sim[j][i] = s;
                if (s >= THRESHOLD) {
                    uf.union(i, j);
                }
            }
        }

        Map<Integer, List<Integer>> components = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            components.computeIfAbsent(uf.find(i), k -> new ArrayList<>()).add(i);
        }

        List<CandidateGroup> groups = new ArrayList<>();
        int groupCounter = 1;
        for (List<Integer> members : components.values()) {
            if (members.size() < 2) {
                continue; // singleton - not part of any group
            }
            double minSim = 1.0;
            boolean allIdentical = true;
            for (int a = 0; a < members.size(); a++) {
                for (int b = a + 1; b < members.size(); b++) {
                    int i = members.get(a);
                    int j = members.get(b);
                    minSim = Math.min(minSim, sim[i][j]);
                    if (!normalized[i].equals(normalized[j])) {
                        allIdentical = false;
                    }
                }
            }
            List<String> ids = new ArrayList<>();
            for (int idx : members) {
                ids.add(playlists.get(idx).id());
            }
            groups.add(new CandidateGroup("grp-" + groupCounter++, ids, minSim, allIdentical ? "exact" : "fuzzy"));
        }
        return groups;
    }

    /** Simple union-find (disjoint set) with path compression + union by rank. */
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
