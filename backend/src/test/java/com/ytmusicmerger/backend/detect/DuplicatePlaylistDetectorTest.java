package com.ytmusicmerger.backend.detect;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DuplicatePlaylistDetectorTest {

    private final DuplicatePlaylistDetector detector = new DuplicatePlaylistDetector();

    @Test
    void identicalNamesAfterNormalizationFormAnExactGroup() {
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "🎵 Chill Music 2024!!"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "chill music 2024")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).hasSize(1);
        var group = groups.get(0);
        assertThat(group.playlistIds()).containsExactlyInAnyOrder("PL1", "PL2");
        assertThat(group.confidence()).isEqualTo(1.0);
        assertThat(group.matchType()).isEqualTo("exact");
    }

    @Test
    void reorderedTokensFormAFuzzyGroupAboveThreshold() {
        // Combined similarity = avg(Jaro-Winkler, token-sort ratio). Token-sort ratio is
        // 1.0 for a pure reorder, but Jaro-Winkler penalizes the changed prefix, so only
        // reorders with enough shared content clear the 0.85 average threshold.
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "Road Trip Playlist 2024"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "Playlist 2024 Road Trip")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).matchType()).isEqualTo("fuzzy");
        assertThat(groups.get(0).confidence()).isGreaterThanOrEqualTo(DuplicatePlaylistDetector.THRESHOLD);
    }

    @Test
    void nearMatchAboveThresholdIsGrouped() {
        // "Chill Music 2024" vs "Chill Music 2025" - one differing token, high overlap.
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "Chill Music 2024"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "Chill Music 2025")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).matchType()).isEqualTo("fuzzy");
        assertThat(groups.get(0).confidence()).isGreaterThanOrEqualTo(DuplicatePlaylistDetector.THRESHOLD);
    }

    @Test
    void genuinelyDifferentNamesBelowThresholdAreNotGrouped() {
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "Chill Music"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "Workout Mix")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).isEmpty();
    }

    @Test
    void singletonPlaylistIsNotPartOfAnyGroup() {
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "Calm"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "Calm"),
                new DuplicatePlaylistDetector.PlaylistInput("PL3", "Totally Unrelated Playlist Name")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).hasSize(1);
        assertThat(groups.get(0).playlistIds()).containsExactlyInAnyOrder("PL1", "PL2");
    }

    @Test
    void singleOrEmptyListProducesNoGroups() {
        assertThat(detector.detect(List.of())).isEmpty();
        assertThat(detector.detect(List.of(new DuplicatePlaylistDetector.PlaylistInput("PL1", "Calm")))).isEmpty();
    }

    @Test
    void confidenceIsTheMinimumPairwiseSimilarityInTheGroup() {
        // PL1/PL2 identical (1.0), PL3 fuzzy-connects to both (single-character typo),
        // pulling the whole component's confidence down to the weakest link and marking
        // it "fuzzy" overall even though two of the three members are an exact match.
        var playlists = List.of(
                new DuplicatePlaylistDetector.PlaylistInput("PL1", "Road Trip Mix"),
                new DuplicatePlaylistDetector.PlaylistInput("PL2", "Road Trip Mix"),
                new DuplicatePlaylistDetector.PlaylistInput("PL3", "Road Trip Mixx")
        );

        var groups = detector.detect(playlists);

        assertThat(groups).hasSize(1);
        var group = groups.get(0);
        assertThat(group.playlistIds()).containsExactlyInAnyOrder("PL1", "PL2", "PL3");
        assertThat(group.matchType()).isEqualTo("fuzzy");
        assertThat(group.confidence()).isLessThan(1.0);
    }
}
