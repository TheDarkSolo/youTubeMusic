package com.ytmusicmerger.backend.merge;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** §5.8-5.9. */
@RestController
@RequestMapping("/api/merge")
public class MergeController {

    private final MergePlanService mergePlanService;

    public MergeController(MergePlanService mergePlanService) {
        this.mergePlanService = mergePlanService;
    }

    @PostMapping("/preview")
    public MergePreviewResponse preview(@RequestBody MergePreviewRequest request) {
        return mergePlanService.preview(request);
    }

    @PostMapping("/execute")
    public MergeExecuteResponse execute(@RequestBody MergeExecuteRequest request) {
        return mergePlanService.execute(request);
    }
}
