package com.ytmusicmerger.backend.playlist;

import org.springframework.web.bind.annotation.*;

/** §5.5-5.6, §5.12. */
@RestController
@RequestMapping("/api/playlists")
public class PlaylistController {

    private final PlaylistService playlistService;

    public PlaylistController(PlaylistService playlistService) {
        this.playlistService = playlistService;
    }

    @GetMapping
    public PlaylistsResponse listPlaylists() {
        return playlistService.listPlaylistsWithDuplicates();
    }

    @GetMapping("/{playlistId}/tracks")
    public TracksResponse listTracks(@PathVariable String playlistId,
                                      @RequestParam(required = false) String pageToken) {
        return playlistService.listTracksPage(playlistId, pageToken);
    }

    @DeleteMapping("/{playlistId}")
    public DeletePlaylistResponse deletePlaylist(@PathVariable String playlistId) {
        playlistService.deletePlaylist(playlistId);
        return new DeletePlaylistResponse(true, playlistId);
    }
}
