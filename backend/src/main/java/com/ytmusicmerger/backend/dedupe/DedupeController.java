package com.ytmusicmerger.backend.dedupe;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** §5.10-5.11. */
@RestController
@RequestMapping("/api/dedupe")
public class DedupeController {

    private final DedupePlanService dedupePlanService;

    public DedupeController(DedupePlanService dedupePlanService) {
        this.dedupePlanService = dedupePlanService;
    }

    @PostMapping("/preview")
    public DedupePreviewResponse preview(@RequestBody DedupePreviewRequest request) {
        return dedupePlanService.preview(request);
    }

    @PostMapping("/execute")
    public DedupeExecuteResponse execute(@RequestBody DedupeExecuteRequest request) {
        return dedupePlanService.execute(request);
    }
}
