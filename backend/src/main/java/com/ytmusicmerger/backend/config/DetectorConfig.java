package com.ytmusicmerger.backend.config;

import com.ytmusicmerger.backend.detect.DuplicatePlaylistDetector;
import com.ytmusicmerger.backend.detect.DuplicateTrackDetector;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the pure, dependency-free detectors (§3/§4) as singleton beans so the Spring
 * layer can inject them normally, without the detector classes themselves taking on any
 * Spring/API dependency.
 */
@Configuration
public class DetectorConfig {

    @Bean
    public DuplicatePlaylistDetector duplicatePlaylistDetector() {
        return new DuplicatePlaylistDetector();
    }

    @Bean
    public DuplicateTrackDetector duplicateTrackDetector() {
        return new DuplicateTrackDetector();
    }
}
