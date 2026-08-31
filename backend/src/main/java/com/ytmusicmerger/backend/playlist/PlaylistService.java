package com.ytmusicmerger.backend.playlist;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.*;
import com.ytmusicmerger.backend.auth.AuthService;
import com.ytmusicmerger.backend.auth.GoogleTokenHolder;
import com.ytmusicmerger.backend.detect.DuplicatePlaylistDetector;
import com.ytmusicmerger.backend.error.ApiException;
import com.ytmusicmerger.backend.error.ErrorCode;
import com.ytmusicmerger.backend.error.GoogleApiErrorTranslator;
import com.ytmusicmerger.backend.youtube.ThumbnailUtil;
import com.ytmusicmerger.backend.youtube.YouTubeClientFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Wraps {@code playlists.list}, {@code playlistItems.list}, {@code playlistItems.insert},
 * {@code playlistItems.delete}, {@code playlists.insert} behind a typed Java API (§1).
 * Handles pagination internally; Google API exceptions propagate to
 * {@code GlobalExceptionHandler} for §5.7 translation.
 */
@Service
public class PlaylistService {

    private static final long PAGE_SIZE = 50L;

    private final YouTubeClientFactory clientFactory;
    private final AuthService authService;
    private final GoogleTokenHolder tokenHolder;
    private final DuplicatePlaylistDetector duplicatePlaylistDetector;

    public PlaylistService(YouTubeClientFactory clientFactory, AuthService authService,
                            GoogleTokenHolder tokenHolder, DuplicatePlaylistDetector duplicatePlaylistDetector) {
        this.clientFactory = clientFactory;
        this.authService = authService;
        this.tokenHolder = tokenHolder;
        this.duplicatePlaylistDetector = duplicatePlaylistDetector;
    }

    private YouTube client() {
        String token = authService.ensureValidAccessToken(tokenHolder);
        return clientFactory.forAccessToken(token);
    }

    /** §5.5 - all of the user's playlists, annotated with duplicate-group membership. */
    public PlaylistsResponse listPlaylistsWithDuplicates() {
        List<Playlist> raw = fetchAllOwnPlaylists(client());

        List<DuplicatePlaylistDetector.PlaylistInput> inputs = new ArrayList<>();
        for (Playlist p : raw) {
            String title = p.getSnippet() != null ? p.getSnippet().getTitle() : "";
            inputs.add(new DuplicatePlaylistDetector.PlaylistInput(p.getId(), title));
        }
        List<DuplicatePlaylistDetector.CandidateGroup> groups = duplicatePlaylistDetector.detect(inputs);

        Map<String, String> playlistIdToGroupId = new HashMap<>();
        List<DuplicateGroupDto> groupDtos = new ArrayList<>();
        for (DuplicatePlaylistDetector.CandidateGroup g : groups) {
            groupDtos.add(new DuplicateGroupDto(g.id(), g.playlistIds(), round(g.confidence()), g.matchType()));
            for (String pid : g.playlistIds()) {
                playlistIdToGroupId.put(pid, g.id());
            }
        }

        List<PlaylistDto> playlistDtos = new ArrayList<>();
        for (Playlist p : raw) {
            String title = p.getSnippet() != null ? p.getSnippet().getTitle() : "";
            long itemCount = p.getContentDetails() != null && p.getContentDetails().getItemCount() != null
                    ? p.getContentDetails().getItemCount() : 0L;
            String thumb = p.getSnippet() != null ? ThumbnailUtil.bestUrl(p.getSnippet().getThumbnails()) : null;
            playlistDtos.add(new PlaylistDto(p.getId(), title, itemCount, thumb, playlistIdToGroupId.get(p.getId())));
        }

        return new PlaylistsResponse(playlistDtos, groupDtos);
    }

    /** §5.6 - a single page of a playlist's tracks. */
    public TracksResponse listTracksPage(String playlistId, String pageToken) {
        try {
            YouTube.PlaylistItems.List request = client().playlistItems()
                    .list(List.of("snippet"))
                    .setPlaylistId(playlistId)
                    .setMaxResults(PAGE_SIZE);
            if (pageToken != null && !pageToken.isBlank()) {
                request.setPageToken(pageToken);
            }
            PlaylistItemListResponse response = request.execute();
            List<TrackDto> items = new ArrayList<>();
            if (response.getItems() != null) {
                for (PlaylistItem item : response.getItems()) {
                    items.add(toRecord(playlistId, item).toTrackDto());
                }
            }
            return new TracksResponse(playlistId, items, response.getNextPageToken());
        } catch (IOException e) {
            if (e instanceof GoogleJsonResponseException gje) {
                throw GoogleApiErrorTranslator.translate(gje);
            }
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to fetch playlist tracks from YouTube.");
        }
    }

    /** Fetches every item across all pages - used internally by merge/dedupe plan building. */
    public List<PlaylistItemRecord> fetchAllTracks(String playlistId) {
        return fetchAllTracks(client(), playlistId);
    }

    private List<PlaylistItemRecord> fetchAllTracks(YouTube youTube, String playlistId) {
        List<PlaylistItemRecord> all = new ArrayList<>();
        String pageToken = null;
        try {
            do {
                YouTube.PlaylistItems.List request = youTube.playlistItems()
                        .list(List.of("snippet"))
                        .setPlaylistId(playlistId)
                        .setMaxResults(PAGE_SIZE);
                if (pageToken != null) {
                    request.setPageToken(pageToken);
                }
                PlaylistItemListResponse response = request.execute();
                if (response.getItems() != null) {
                    for (PlaylistItem item : response.getItems()) {
                        all.add(toRecord(playlistId, item));
                    }
                }
                pageToken = response.getNextPageToken();
            } while (pageToken != null);
        } catch (IOException e) {
            if (e instanceof GoogleJsonResponseException gje) {
                throw GoogleApiErrorTranslator.translate(gje);
            }
            throw new ApiException(ErrorCode.INTERNAL_ERROR,
                    "Failed to fetch playlist tracks from YouTube (playlist " + playlistId + ").");
        }
        return all;
    }

    /** Metadata (title/itemCount) for a set of playlist ids, chunked to respect API limits. */
    public List<PlaylistMeta> fetchPlaylistMeta(List<String> playlistIds) {
        if (playlistIds.isEmpty()) {
            return List.of();
        }
        YouTube youTube = client();
        List<PlaylistMeta> result = new ArrayList<>();
        int chunkSize = 50;
        try {
            for (int i = 0; i < playlistIds.size(); i += chunkSize) {
                List<String> chunk = playlistIds.subList(i, Math.min(i + chunkSize, playlistIds.size()));
                PlaylistListResponse response = youTube.playlists()
                        .list(List.of("snippet", "contentDetails"))
                        .setId(chunk)
                        .setMaxResults((long) chunkSize)
                        .execute();
                if (response.getItems() != null) {
                    for (Playlist p : response.getItems()) {
                        String title = p.getSnippet() != null ? p.getSnippet().getTitle() : "";
                        long itemCount = p.getContentDetails() != null && p.getContentDetails().getItemCount() != null
                                ? p.getContentDetails().getItemCount() : 0L;
                        result.add(new PlaylistMeta(p.getId(), title, itemCount));
                    }
                }
            }
        } catch (IOException e) {
            if (e instanceof GoogleJsonResponseException gje) {
                throw GoogleApiErrorTranslator.translate(gje);
            }
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to fetch playlist metadata from YouTube.");
        }
        return result;
    }

    /** Creates a brand-new playlist for merge target.mode == "create". */
    public PlaylistMeta createPlaylist(String title) {
        try {
            Playlist body = new Playlist().setSnippet(new PlaylistSnippet().setTitle(title));
            Playlist created = client().playlists().insert(List.of("snippet"), body).execute();
            return new PlaylistMeta(created.getId(), title, 0L);
        } catch (IOException e) {
            if (e instanceof GoogleJsonResponseException gje) {
                throw GoogleApiErrorTranslator.translate(gje);
            }
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to create the target playlist on YouTube.");
        }
    }

    /** Adds a video to a playlist; returns the new playlistItemId. */
    public String insertPlaylistItem(String playlistId, String videoId) throws IOException {
        PlaylistItem body = new PlaylistItem().setSnippet(new PlaylistItemSnippet()
                .setPlaylistId(playlistId)
                .setResourceId(new ResourceId().setKind("youtube#video").setVideoId(videoId)));
        PlaylistItem created = client().playlistItems().insert(List.of("snippet"), body).execute();
        return created.getId();
    }

    /** Removes a single playlistItem (not the video itself, just its membership in the playlist). */
    public void deletePlaylistItem(String playlistItemId) throws IOException {
        client().playlistItems().delete(playlistItemId).execute();
    }

    private List<Playlist> fetchAllOwnPlaylists(YouTube youTube) {
        List<Playlist> all = new ArrayList<>();
        String pageToken = null;
        try {
            do {
                YouTube.Playlists.List request = youTube.playlists()
                        .list(List.of("snippet", "contentDetails"))
                        .setMine(true)
                        .setMaxResults(PAGE_SIZE);
                if (pageToken != null) {
                    request.setPageToken(pageToken);
                }
                PlaylistListResponse response = request.execute();
                if (response.getItems() != null) {
                    all.addAll(response.getItems());
                }
                pageToken = response.getNextPageToken();
            } while (pageToken != null);
        } catch (IOException e) {
            if (e instanceof GoogleJsonResponseException gje) {
                throw GoogleApiErrorTranslator.translate(gje);
            }
            throw new ApiException(ErrorCode.INTERNAL_ERROR, "Failed to fetch playlists from YouTube.");
        }
        return all;
    }

    private PlaylistItemRecord toRecord(String playlistId, PlaylistItem item) {
        PlaylistItemSnippet snippet = item.getSnippet();
        String videoId = snippet != null && snippet.getResourceId() != null ? snippet.getResourceId().getVideoId() : null;
        String title = snippet != null ? snippet.getTitle() : "";
        String channelTitle = null;
        String channelId = null;
        if (snippet != null) {
            // Prefer the uploading video's own channel over the playlist owner's channel.
            channelTitle = snippet.getVideoOwnerChannelTitle() != null
                    ? snippet.getVideoOwnerChannelTitle() : snippet.getChannelTitle();
            channelId = snippet.getVideoOwnerChannelId() != null
                    ? snippet.getVideoOwnerChannelId() : snippet.getChannelId();
        }
        String thumb = snippet != null ? ThumbnailUtil.bestUrl(snippet.getThumbnails()) : null;
        return new PlaylistItemRecord(playlistId, item.getId(), videoId, title, channelTitle, channelId, thumb);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
