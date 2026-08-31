package com.ytmusicmerger.backend.detect;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DuplicateTrackDetectorTest {

    private final DuplicateTrackDetector detector = new DuplicateTrackDetector();

    private static DuplicateTrackDetector.TrackInput track(String playlistId, String itemId, String videoId,
                                                             String title, String channelId, String channelTitle) {
        return new DuplicateTrackDetector.TrackInput(playlistId, itemId, videoId, title, channelId, channelTitle);
    }

    @Test
    void exactVideoIdDuplicatesAreGroupedRegardlessOfMetadata() {
        var items = List.of(
                track("PL1", "item1", "abc123", "Song Title", "UC1", "Artist"),
                track("PL2", "item2", "abc123", "Completely Different Title Text", "UC2", "Other Channel")
        );

        var result = detector.detect(items);

        assertThat(result.exact()).hasSize(1);
        assertThat(result.exact().get(0).videoId()).isEqualTo("abc123");
        assertThat(result.exact().get(0).items()).hasSize(2);
        assertThat(result.possible()).isEmpty();
    }

    @Test
    void fuzzyTitleDuplicateWithNoiseTokensIsDetectedAsPossible() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Song B (Official Audio)", "UC1", "Artist"),
                track("PL2", "item2", "vid2", "Song B", "UC1TOPIC", "Artist - Topic")
        );

        var result = detector.detect(items);

        assertThat(result.exact()).isEmpty();
        assertThat(result.possible()).hasSize(1);
        var group = result.possible().get(0);
        assertThat(group.items()).hasSize(2);
        assertThat(group.similarity()).isGreaterThanOrEqualTo(DuplicateTrackDetector.TITLE_THRESHOLD);
    }

    @Test
    void featAndBracketNoiseIsStrippedBeforeComparison() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Cool Song [HD]", "UC1", "Artist"),
                track("PL2", "item2", "vid2", "Cool Song (feat. Someone Else)", "UC1", "Artist")
        );

        var result = detector.detect(items);

        assertThat(result.possible()).hasSize(1);
    }

    @Test
    void sameChannelIdOverridesFuzzyChannelTitleMismatch() {
        var items = List.of(
                track("PL1", "item1", "vid1", "My Song", "UCSAME", "Weird Name A"),
                track("PL2", "item2", "vid2", "My Song", "UCSAME", "Totally Different Name Z")
        );

        var result = detector.detect(items);

        assertThat(result.possible()).hasSize(1);
    }

    @Test
    void belowTitleThresholdIsNotAPossibleDuplicate() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Song One", "UC1", "Artist"),
                track("PL2", "item2", "vid2", "Umbrella", "UC1", "Artist")
        );

        var result = detector.detect(items);

        assertThat(result.possible()).isEmpty();
    }

    @Test
    void similarTitleButDifferentUnrelatedChannelIsNotAPossibleDuplicate() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Sunrise", "UC1", "Alpha Records"),
                track("PL2", "item2", "vid2", "Sunrise", "UC2", "Beta Studios")
        );

        var result = detector.detect(items);

        assertThat(result.possible()).isEmpty();
    }

    @Test
    void noFalsePositivesOnGenuinelyDifferentContent() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Bohemian Rhapsody", "UC1", "Queen Official"),
                track("PL2", "item2", "vid2", "Stairway to Heaven", "UC2", "Led Zeppelin"),
                track("PL3", "item3", "vid3", "Hotel California", "UC3", "Eagles")
        );

        var result = detector.detect(items);

        assertThat(result.exact()).isEmpty();
        assertThat(result.possible()).isEmpty();
    }

    @Test
    void itemsAlreadyCoveredByExactMatchAreExcludedFromPossibleMatching() {
        var items = List.of(
                track("PL1", "item1", "vid1", "Song X", "UC1", "Artist"),
                track("PL2", "item2", "vid1", "Song X", "UC1", "Artist"),
                track("PL3", "item3", "vid2", "Song X (Official Video)", "UC1", "Artist")
        );

        var result = detector.detect(items);

        assertThat(result.exact()).hasSize(1);
        // vid2 is fuzzy-similar to the exact pair, but should still surface as a possible
        // duplicate against the remaining (non-exact-covered) representation - none left in
        // this case since only one item has vid2 and its exact-duplicate counterparts were
        // excluded, so there is no partner left to pair it with.
        assertThat(result.possible()).isEmpty();
    }
}
