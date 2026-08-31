package com.ytmusicmerger.backend.auth;

import com.google.api.client.auth.oauth2.TokenResponseException;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleRefreshTokenRequest;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.client.http.GenericUrl;
import com.google.api.client.http.HttpTransport;
import com.google.api.client.json.JsonFactory;
import com.ytmusicmerger.backend.config.GoogleOAuthProperties;
import com.ytmusicmerger.backend.error.ApiException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.UUID;

/**
 * Hand-rolled wrapper around Google's OAuth 2.0 Authorization Code flow (§2). Deliberately
 * does not pull in Spring Security's OAuth2 client machinery - the flow is only four steps
 * and a plain controller + this helper is simpler than configuring a full
 * ClientRegistrationRepository for a single, fixed provider.
 */
@Component
public class GoogleOAuthClient {

    private static final String AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

    /**
     * Read/write scope - required because merging performs playlistItems.insert/delete and
     * playlists.delete. youtube.readonly would be insufficient (§2).
     */
    public static final String SCOPE = "https://www.googleapis.com/auth/youtube";

    private final HttpTransport httpTransport;
    private final JsonFactory jsonFactory;
    private final GoogleOAuthProperties properties;

    public GoogleOAuthClient(HttpTransport httpTransport, JsonFactory jsonFactory, GoogleOAuthProperties properties) {
        this.httpTransport = httpTransport;
        this.jsonFactory = jsonFactory;
        this.properties = properties;
    }

    /** Generates a fresh CSRF `state` token for the login redirect. */
    public String generateState() {
        return UUID.randomUUID().toString();
    }

    /** Builds the Google consent-screen URL for step 2 of the flow. */
    public String buildAuthorizationUrl(String state) {
        GenericUrl url = new GenericUrl(AUTH_ENDPOINT);
        url.set("client_id", properties.getClientId());
        url.set("redirect_uri", properties.getRedirectUri());
        url.set("response_type", "code");
        url.set("scope", SCOPE);
        url.set("access_type", "offline");
        url.set("prompt", "consent");
        url.set("state", state);
        return url.build();
    }

    public record TokenResult(String accessToken, String refreshToken, Instant expiresAt) {
    }

    /** Step 4: exchanges the authorization `code` for an access/refresh token pair. */
    public TokenResult exchangeCode(String code) {
        try {
            GoogleTokenResponse response = new GoogleAuthorizationCodeTokenRequest(
                    httpTransport, jsonFactory,
                    TOKEN_ENDPOINT,
                    properties.getClientId(),
                    properties.getClientSecret(),
                    code,
                    properties.getRedirectUri())
                    .execute();
            return toResult(response);
        } catch (TokenResponseException e) {
            throw ApiException.unauthenticated("Failed to exchange authorization code with Google: "
                    + e.getDetails());
        } catch (IOException e) {
            throw new ApiException(com.ytmusicmerger.backend.error.ErrorCode.INTERNAL_ERROR,
                    "Failed to reach Google's token endpoint.");
        }
    }

    /** Silent refresh using the stored refresh_token, per §2's 60s-buffer refresh rule. */
    public TokenResult refresh(String refreshToken) {
        try {
            GoogleTokenResponse response = new GoogleRefreshTokenRequest(
                    httpTransport, jsonFactory,
                    refreshToken,
                    properties.getClientId(),
                    properties.getClientSecret())
                    .execute();
            return toResult(response);
        } catch (TokenResponseException e) {
            throw ApiException.unauthenticated("Session expired and could not be refreshed. Please log in again.");
        } catch (IOException e) {
            throw new ApiException(com.ytmusicmerger.backend.error.ErrorCode.INTERNAL_ERROR,
                    "Failed to reach Google's token endpoint while refreshing.");
        }
    }

    private TokenResult toResult(GoogleTokenResponse response) {
        Instant expiresAt = Instant.now().plusSeconds(response.getExpiresInSeconds() != null
                ? response.getExpiresInSeconds() : 3600L);
        return new TokenResult(response.getAccessToken(), response.getRefreshToken(), expiresAt);
    }
}
