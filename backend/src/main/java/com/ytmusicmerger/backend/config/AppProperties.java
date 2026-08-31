package com.ytmusicmerger.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Binds {@code app.*} - sourced from FRONTEND_BASE_URL. */
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String frontendBaseUrl;

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    public void setFrontendBaseUrl(String frontendBaseUrl) {
        this.frontendBaseUrl = frontendBaseUrl;
    }
}
