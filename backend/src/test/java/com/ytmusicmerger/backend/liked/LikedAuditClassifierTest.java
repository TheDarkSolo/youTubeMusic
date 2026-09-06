package com.ytmusicmerger.backend.liked;

import com.ytmusicmerger.backend.playlist.PlaylistItemRecord;
import com.ytmusicmerger.backend.playlist.VideoMetaRecord;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LikedAuditClassifierTest {

    private static PlaylistItemRecord item(String itemId, String videoId, String title, String channelTitle) {
        return new PlaylistItemRecord("LL", itemId, videoId, title, channelTitle, "UCsomeChannel", null);
    }

    @Test
    void musicCategoryVideosCountTowardMusicCountNotGroups() {
        var items = List.of(
                item("i1", "song1", "A Song", "An Artist"),
                item("i2", "song2", "Another Song", "Another Artist")
        );
        var metas = Map.of(
                "song1", new VideoMetaRecord("song1", "A Song", "An Artist", "10"),
                "song2", new VideoMetaRecord("song2", "Another Song", "Another Artist", "10")
        );

        var result = LikedAuditClassifier.classify(items, metas, Map.of());

        assertThat(result.totalLiked()).isEqualTo(2);
        assertThat(result.musicCount()).isEqualTo(2);
        assertThat(result.nonMusicGroups()).isEmpty();
    }

    @Test
    void nonMusicVideosAreGroupedByCategoryIdWithResolvedNames() {
        var items = List.of(
                item("i1", "vid1", "Let's Play Something", "GamerChannel"),
                item("i2", "vid2", "Another Playthrough", "GamerChannel"),
                item("i3", "vid3", "Music Track", "Musician")
        );
        var metas = Map.of(
                "vid1", new VideoMetaRecord("vid1", "Let's Play Something", "GamerChannel", "20"),
                "vid2", new VideoMetaRecord("vid2", "Another Playthrough", "GamerChannel", "20"),
                "vid3", new VideoMetaRecord("vid3", "Music Track", "Musician", "10")
        );
        var categoryNames = Map.of("20", "Gaming");

        var result = LikedAuditClassifier.classify(items, metas, categoryNames);

        assertThat(result.totalLiked()).isEqualTo(3);
        assertThat(result.musicCount()).isEqualTo(1);
        assertThat(result.nonMusicGroups()).hasSize(1);
        var group = result.nonMusicGroups().get(0);
        assertThat(group.categoryId()).isEqualTo("20");
        assertThat(group.categoryName()).isEqualTo("Gaming");
        assertThat(group.items()).extracting("videoId").containsExactly("vid1", "vid2");
    }

    @Test
    void unresolvedVideoMetadataFallsBackToPlaylistItemDataAndUnknownCategory() {
        var items = List.of(item("i1", "deletedVid", "Fallback Title", "Fallback Channel"));

        var result = LikedAuditClassifier.classify(items, Map.of(), Map.of());

        assertThat(result.musicCount()).isEqualTo(0);
        assertThat(result.nonMusicGroups()).hasSize(1);
        var group = result.nonMusicGroups().get(0);
        assertThat(group.categoryId()).isEqualTo("unknown");
        assertThat(group.categoryName()).isEqualTo("Unknown");
        assertThat(group.items().get(0).title()).isEqualTo("Fallback Title");
        assertThat(group.items().get(0).channelTitle()).isEqualTo("Fallback Channel");
    }

    @Test
    void sameVideoLikedTwiceInTheRawListIsCountedOnce() {
        // The "Liked videos" list is live and ordered by recency, so paginating it while
        // something is actively liking tracks can surface the same videoId on two consecutive
        // pages. Confirmed live: a real audit reported 834 music vs 832 shown in Liked Music.
        var items = List.of(
                item("i1", "song1", "A Song", "An Artist"),
                item("i2", "vidGaming", "Let's Play", "GamerChannel"),
                item("i3", "song1", "A Song", "An Artist"), // duplicate row, same videoId
                item("i4", "vidGaming", "Let's Play", "GamerChannel") // duplicate row, same videoId
        );
        var metas = Map.of(
                "song1", new VideoMetaRecord("song1", "A Song", "An Artist", "10"),
                "vidGaming", new VideoMetaRecord("vidGaming", "Let's Play", "GamerChannel", "20")
        );

        var result = LikedAuditClassifier.classify(items, metas, Map.of("20", "Gaming"));

        assertThat(result.totalLiked()).isEqualTo(2);
        assertThat(result.musicCount()).isEqualTo(1);
        assertThat(result.nonMusicGroups()).hasSize(1);
        assertThat(result.nonMusicGroups().get(0).items()).hasSize(1);
    }

    @Test
    void missingCategoryNameFallsBackToUnknownLabelButKeepsRealCategoryId() {
        var items = List.of(item("i1", "vid1", "Some Video", "Some Channel"));
        var metas = Map.of("vid1", new VideoMetaRecord("vid1", "Some Video", "Some Channel", "22"));

        var result = LikedAuditClassifier.classify(items, metas, Map.of());

        var group = result.nonMusicGroups().get(0);
        assertThat(group.categoryId()).isEqualTo("22");
        assertThat(group.categoryName()).isEqualTo("Unknown");
    }
}
