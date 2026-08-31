package com.ytmusicmerger.backend.detect;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Pure text-normalization helpers shared by {@link DuplicatePlaylistDetector} and
 * {@link DuplicateTrackDetector}. No Spring / Google API dependencies - safe to unit test
 * in isolation and to reuse from either detector.
 */
public final class TextNormalizer {

    // Symbol / pictographic categories: covers emoji (most emoji fall in "So"), dingbats,
    // decorative glyphs like ★ ♪ • as well as modifier symbols (skin-tone modifiers etc).
    private static final Pattern SYMBOLS = Pattern.compile("[\\p{So}\\p{Sk}\\p{Cn}]+");

    // Anything that isn't a letter/digit (any script) or whitespace.
    private static final Pattern NON_ALNUM_SPACE = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}\\s]+");

    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    // §4 noise tokens / parentheticals stripped from track titles before comparison.
    private static final Pattern NOISE_PARENTHETICALS = Pattern.compile(
            "[\\(\\[]\\s*(official\\s+(music\\s+)?(video|audio)|official\\s+lyric\\s+video|lyrics?|audio|hd)\\s*[\\)\\]]",
            Pattern.CASE_INSENSITIVE);

    // "feat. X" / "ft. X" segments, with or without a leading opening bracket, run to the
    // end of the (remaining) string or to a closing bracket.
    private static final Pattern FEAT_SEGMENT = Pattern.compile(
            "[\\(\\[]?\\s*\\b(feat|ft)\\.?\\s+[^\\)\\]]*[\\)\\]]?",
            Pattern.CASE_INSENSITIVE);

    // YouTube auto-generated "Artist - Topic" channel suffix.
    private static final Pattern TOPIC_SUFFIX = Pattern.compile("\\s*-\\s*topic\\s*$", Pattern.CASE_INSENSITIVE);

    private TextNormalizer() {
    }

    /**
     * §3 playlist-title normalization:
     * NFKC normalize -> strip emoji/decorative symbols -> lowercase -> strip punctuation
     * (keep alphanumerics + spaces) -> collapse whitespace -> trim.
     */
    public static String normalizePlaylistTitle(String raw) {
        if (raw == null) {
            return "";
        }
        String s = Normalizer.normalize(raw, Normalizer.Form.NFKC);
        s = SYMBOLS.matcher(s).replaceAll("");
        s = s.toLowerCase(java.util.Locale.ROOT);
        s = NON_ALNUM_SPACE.matcher(s).replaceAll("");
        s = WHITESPACE.matcher(s).replaceAll(" ").trim();
        return s;
    }

    /**
     * §4 track-title normalization: lowercase, NFKC normalize, strip noise
     * tokens/parentheticals ((official video), (official audio), (lyrics), (audio), [hd],
     * feat./ft. segments), strip remaining punctuation, collapse whitespace.
     */
    public static String normalizeTrackTitle(String raw) {
        if (raw == null) {
            return "";
        }
        String s = Normalizer.normalize(raw, Normalizer.Form.NFKC);
        s = s.toLowerCase(java.util.Locale.ROOT);
        s = NOISE_PARENTHETICALS.matcher(s).replaceAll(" ");
        s = FEAT_SEGMENT.matcher(s).replaceAll(" ");
        s = SYMBOLS.matcher(s).replaceAll("");
        s = NON_ALNUM_SPACE.matcher(s).replaceAll(" ");
        s = WHITESPACE.matcher(s).replaceAll(" ").trim();
        return s;
    }

    /**
     * §4 channel-title normalization: lowercase/NFKC, strip the "- Topic" auto-generated
     * suffix, strip punctuation, collapse whitespace.
     */
    public static String normalizeChannelTitle(String raw) {
        if (raw == null) {
            return "";
        }
        String s = Normalizer.normalize(raw, Normalizer.Form.NFKC);
        s = s.toLowerCase(java.util.Locale.ROOT);
        s = TOPIC_SUFFIX.matcher(s).replaceAll("");
        s = SYMBOLS.matcher(s).replaceAll("");
        s = NON_ALNUM_SPACE.matcher(s).replaceAll(" ");
        s = WHITESPACE.matcher(s).replaceAll(" ").trim();
        return s;
    }

    /** Whitespace-tokenize, sort tokens alphabetically, rejoin with single spaces. */
    public static String tokenSortKey(String normalized) {
        if (normalized == null || normalized.isBlank()) {
            return "";
        }
        String[] tokens = WHITESPACE.split(normalized.trim());
        java.util.Arrays.sort(tokens);
        return String.join(" ", tokens);
    }
}
