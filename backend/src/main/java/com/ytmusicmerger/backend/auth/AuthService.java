package com.ytmusicmerger.backend.auth;

import com.ytmusicmerger.backend.error.ApiException;
import org.springframework.stereotype.Service;

/**
 * Ensures every outgoing YouTube API call has a valid access token, silently refreshing
 * via the stored refresh_token when the token is missing/expired or within the 60s buffer
 * (§2, "Token storage").
 */
@Service
public class AuthService {

    private final GoogleOAuthClient oAuthClient;

    public AuthService(GoogleOAuthClient oAuthClient) {
        this.oAuthClient = oAuthClient;
    }

    /**
     * Returns a valid access token for the given session's token holder, refreshing first
     * if necessary. Throws {@code 401 UNAUTHENTICATED} if there is no session or refresh
     * fails.
     */
    public String ensureValidAccessToken(GoogleTokenHolder holder) {
        if (!holder.isAuthenticated()) {
            throw ApiException.unauthenticated("No active YouTube session. Please log in again.");
        }
        if (holder.needsRefresh()) {
            GoogleOAuthClient.TokenResult refreshed = oAuthClient.refresh(holder.getRefreshToken());
            holder.storeTokens(refreshed.accessToken(), refreshed.refreshToken(), refreshed.expiresAt());
        }
        return holder.getAccessToken();
    }
}
