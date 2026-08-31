package com.ytmusicmerger.backend.auth;

import com.google.api.services.youtube.YouTube;
import com.google.api.services.youtube.model.Channel;
import com.google.api.services.youtube.model.ChannelListResponse;
import com.ytmusicmerger.backend.youtube.YouTubeClientFactory;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Objects;

/**
 * §2 / §5.1-5.4: OAuth 2.0 Authorization Code flow against Google, plus session status and
 * logout. `/login` and `/callback` are browser navigations (302 redirects), not fetch/JSON
 * endpoints.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final GoogleOAuthClient oAuthClient;
    private final YouTubeClientFactory youTubeClientFactory;
    private final GoogleTokenHolder tokenHolder;
    private final String frontendBaseUrl;

    public AuthController(GoogleOAuthClient oAuthClient,
                           YouTubeClientFactory youTubeClientFactory,
                           GoogleTokenHolder tokenHolder,
                           @org.springframework.beans.factory.annotation.Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.oAuthClient = oAuthClient;
        this.youTubeClientFactory = youTubeClientFactory;
        this.tokenHolder = tokenHolder;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    /** §5.1 - redirects the browser to Google's OAuth consent screen. */
    @GetMapping("/login")
    public ResponseEntity<Void> login() {
        String state = oAuthClient.generateState();
        tokenHolder.setPendingOAuthState(state);
        String authUrl = oAuthClient.buildAuthorizationUrl(state);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, authUrl)
                .build();
    }

    /** §5.2 - Google redirects here with `code`/`state`; we exchange, store, then bounce to the SPA. */
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam(required = false) String code,
                                          @RequestParam(required = false) String state,
                                          @RequestParam(required = false) String error,
                                          HttpServletRequest request) {
        if (error != null) {
            return redirectToFrontend("oauth_denied");
        }
        String expectedState = tokenHolder.getPendingOAuthState();
        tokenHolder.setPendingOAuthState(null); // one-shot, regardless of outcome
        if (state == null || expectedState == null || !Objects.equals(state, expectedState)) {
            log.warn("OAuth callback state mismatch");
            return redirectToFrontend("invalid_state");
        }
        if (code == null) {
            return redirectToFrontend("missing_code");
        }

        GoogleOAuthClient.TokenResult tokens = oAuthClient.exchangeCode(code);
        tokenHolder.storeTokens(tokens.accessToken(), tokens.refreshToken(), tokens.expiresAt());

        try {
            String channelTitle = fetchAuthenticatedChannelTitle(tokens.accessToken());
            tokenHolder.setChannelTitle(channelTitle);
        } catch (Exception e) {
            // Non-fatal: the session is still authenticated even if we couldn't fetch the
            // display name for the UI.
            log.warn("Could not fetch channel title after OAuth callback", e);
        }

        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, frontendBaseUrl)
                .build();
    }

    /** §5.3 */
    @GetMapping("/status")
    public ResponseEntity<StatusResponse> status() {
        if (!tokenHolder.isAuthenticated()) {
            return ResponseEntity.ok(new StatusResponse(false, null));
        }
        return ResponseEntity.ok(new StatusResponse(true, tokenHolder.getChannelTitle()));
    }

    /** §5.4 */
    @PostMapping("/logout")
    public ResponseEntity<LogoutResponse> logout(HttpServletRequest request) {
        tokenHolder.clear();
        request.getSession().invalidate();
        return ResponseEntity.ok(new LogoutResponse(true));
    }

    private ResponseEntity<Void> redirectToFrontend(String authError) {
        URI uri = UriComponentsBuilder.fromUriString(frontendBaseUrl)
                .queryParam("authError", authError)
                .build(true)
                .toUri();
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, uri.toString()).build();
    }

    private String fetchAuthenticatedChannelTitle(String accessToken) throws Exception {
        YouTube youTube = youTubeClientFactory.forAccessToken(accessToken);
        ChannelListResponse response = youTube.channels()
                .list(List.of("snippet"))
                .setMine(true)
                .execute();
        if (response.getItems() != null && !response.getItems().isEmpty()) {
            Channel channel = response.getItems().get(0);
            return channel.getSnippet() != null ? channel.getSnippet().getTitle() : null;
        }
        return null;
    }

    public record StatusResponse(boolean authenticated, String channelTitle) {
    }

    public record LogoutResponse(boolean loggedOut) {
    }
}
