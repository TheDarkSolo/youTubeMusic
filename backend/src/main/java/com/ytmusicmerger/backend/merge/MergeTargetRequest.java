package com.ytmusicmerger.backend.merge;

/**
 * §5.8 request {@code target}: either {@code {mode:"existing", playlistId}} or
 * {@code {mode:"create", title}}. Also reused (with all fields populated) as the resolved
 * target stored in the cached plan and echoed back in preview/execute responses.
 */
public record MergeTargetRequest(String mode, String playlistId, String title) {

    public boolean isCreate() {
        return "create".equals(mode);
    }

    public boolean isExisting() {
        return "existing".equals(mode);
    }
}
