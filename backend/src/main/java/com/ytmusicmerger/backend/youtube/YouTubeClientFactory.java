package com.ytmusicmerger.backend.youtube;

import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.services.youtube.YouTube;
import org.springframework.stereotype.Component;

/**
 * Builds a per-call {@link YouTube} API client authorized with a bearer access token. We
 * manage the token/refresh lifecycle ourselves via {@code GoogleTokenHolder} +
 * {@code AuthService}, so a lightweight request initializer is enough - no need for the
 * heavier {@code Credential}/{@code StoredCredential} machinery.
 */
@Component
public class YouTubeClientFactory {

    private static final String APPLICATION_NAME = "yt-music-playlist-merger";

    private final HttpTransport httpTransport;
    private final JsonFactory jsonFactory;

    public YouTubeClientFactory(HttpTransport httpTransport, JsonFactory jsonFactory) {
        this.httpTransport = httpTransport;
        this.jsonFactory = jsonFactory;
    }

    public YouTube forAccessToken(String accessToken) {
        return new YouTube.Builder(httpTransport, jsonFactory,
                request -> request.getHeaders().setAuthorization("Bearer " + accessToken))
                .setApplicationName(APPLICATION_NAME)
                .build();
    }
}
