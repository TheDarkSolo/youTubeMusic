package com.ytmusicmerger.backend.detect;

import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.apache.commons.text.similarity.LevenshteinDistance;

/**
 * String similarity helpers built on Apache Commons Text. Pure / stateless - no Spring or
 * Google API dependencies.
 */
public final class SimilarityUtil {

    private static final JaroWinklerSimilarity JARO_WINKLER = new JaroWinklerSimilarity();
    private static final LevenshteinDistance LEVENSHTEIN = LevenshteinDistance.getDefaultInstance();

    private SimilarityUtil() {
    }

    /** Jaro-Winkler similarity in [0.0, 1.0]. */
    public static double jaroWinkler(String a, String b) {
        if (a.isEmpty() && b.isEmpty()) {
            return 1.0;
        }
        return JARO_WINKLER.apply(a, b);
    }

    /**
     * Levenshtein-based ratio in [0.0, 1.0]: {@code 1 - distance / max(len(a), len(b))}.
     * Used as the "token-sort ratio" building block per §3: tokens are sorted/rejoined by
     * the caller before this is applied.
     */
    public static double levenshteinRatio(String a, String b) {
        if (a.isEmpty() && b.isEmpty()) {
            return 1.0;
        }
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) {
            return 1.0;
        }
        int distance = LEVENSHTEIN.apply(a, b);
        return 1.0 - ((double) distance / maxLen);
    }

    /**
     * §3 combined playlist-title similarity: average of Jaro-Winkler on the normalized
     * strings and the token-sort ratio (tokens split on whitespace, sorted, rejoined,
     * compared with the Levenshtein-based ratio).
     */
    public static double combinedTitleSimilarity(String normalizedA, String normalizedB) {
        if (normalizedA.equals(normalizedB)) {
            return 1.0;
        }
        double jw = jaroWinkler(normalizedA, normalizedB);
        String sortedA = TextNormalizer.tokenSortKey(normalizedA);
        String sortedB = TextNormalizer.tokenSortKey(normalizedB);
        double tokenSortRatio = levenshteinRatio(sortedA, sortedB);
        return (jw + tokenSortRatio) / 2.0;
    }
}
