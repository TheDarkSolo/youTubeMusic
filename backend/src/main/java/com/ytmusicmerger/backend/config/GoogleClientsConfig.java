package com.ytmusicmerger.backend.config;

import com.google.api.client.http.HttpTransport;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Shared, stateless Google API client plumbing (no per-user token state lives here). */
@Configuration
public class GoogleClientsConfig {

    @Bean
    public HttpTransport httpTransport() throws Exception {
        return GoogleNetHttpTransport.newTrustedTransport();
    }

    @Bean
    public JsonFactory jsonFactory() {
        return GsonFactory.getDefaultInstance();
    }
}
