package com.ytmusicmerger.backend.youtube;

import com.google.api.services.youtube.model.Thumbnail;
import com.google.api.services.youtube.model.ThumbnailDetails;

/** Picks the best available thumbnail URL, preferring higher resolutions when present. */
public final class ThumbnailUtil {

    private ThumbnailUtil() {
    }

    public static String bestUrl(ThumbnailDetails details) {
        if (details == null) {
            return null;
        }
        Thumbnail t = firstNonNull(details.getHigh(), details.getMedium(), details.getStandard(),
                details.getDefault(), details.getMaxres());
        return t != null ? t.getUrl() : null;
    }

    @SafeVarargs
    private static Thumbnail firstNonNull(Thumbnail... options) {
        for (Thumbnail t : options) {
            if (t != null) {
                return t;
            }
        }
        return null;
    }
}
