package com.ytmusicmerger.backend.auth;

import org.springframework.context.annotation.Scope;
import org.springframework.context.annotation.ScopedProxyMode;
import org.springframework.stereotype.Component;
import org.springframework.web.context.WebApplicationContext;

import java.time.Duration;
import java.time.Instant;

/**
 * §2 "Token storage": session-scoped bean holding the current user's Google token pair
 * in memory only, attached to the Spring {@code HttpSession}. Never persisted to disk,
 * never sent to the browser. A scoped proxy is injected into singleton beans (controllers /
 * services) so each HTTP session gets its own instance transparently.
 */
@Component
@Scope(value = WebApplicationContext.SCOPE_SESSION, proxyMode = ScopedProxyMode.TARGET_CLASS)
public class GoogleTokenHolder {

    /** Buffer before expiry within which we proactively refresh (§2). */
    private static final Duration REFRESH_BUFFER = Duration.ofSeconds(60);

    private String accessToken;
    private String refreshToken;
    private Instant expiresAt;
    private String channelTitle;

    /** Random CSRF `state` stashed between /auth/login and /auth/callback. */
    private String pendingOAuthState;

    public boolean isAuthenticated() {
        return accessToken != null && refreshToken != null;
    }

    public boolean needsRefresh() {
        return expiresAt == null || Instant.now().plus(REFRESH_BUFFER).isAfter(expiresAt);
    }

    public void storeTokens(String accessToken, String refreshToken, Instant expiresAt) {
        this.accessToken = accessToken;
        // Google only returns a refresh_token on first consent; keep the existing one if a
        // subsequent exchange/refresh response omits it.
        if (refreshToken != null) {
            this.refreshToken = refreshToken;
        }
        this.expiresAt = expiresAt;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getChannelTitle() {
        return channelTitle;
    }

    public void setChannelTitle(String channelTitle) {
        this.channelTitle = channelTitle;
    }

    public String getPendingOAuthState() {
        return pendingOAuthState;
    }

    public void setPendingOAuthState(String pendingOAuthState) {
        this.pendingOAuthState = pendingOAuthState;
    }

    public void clear() {
        accessToken = null;
        refreshToken = null;
        expiresAt = null;
        channelTitle = null;
        pendingOAuthState = null;
    }
}
