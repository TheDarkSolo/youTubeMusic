package com.ytmusicmerger.backend.liked;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** §5.16 Liked Music Audit. */
@RestController
@RequestMapping("/api/liked")
public class LikedController {

    private final LikedAuditService likedAuditService;

    public LikedController(LikedAuditService likedAuditService) {
        this.likedAuditService = likedAuditService;
    }

    @GetMapping("/audit")
    public LikedAuditResponse audit() {
        return likedAuditService.audit();
    }

    @PostMapping("/unlike")
    public UnlikeResponse unlike(@RequestBody UnlikeRequest request) {
        return likedAuditService.unlike(request);
    }
}
