package com.ytmusicmerger.backend.library;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** §5.17. */
@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private final LibraryDuplicateScanService libraryDuplicateScanService;

    public LibraryController(LibraryDuplicateScanService libraryDuplicateScanService) {
        this.libraryDuplicateScanService = libraryDuplicateScanService;
    }

    @GetMapping("/duplicate-scan")
    public DuplicateScanResponse duplicateScan() {
        return libraryDuplicateScanService.scan();
    }
}
