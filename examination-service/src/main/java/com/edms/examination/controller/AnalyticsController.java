package com.edms.examination.controller;

import com.edms.examination.dto.AnalyticsOverview;
import com.edms.examination.service.AnalyticsService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Monitoring figures for the admin dashboard. Read-only by design: there is no
 * write endpoint here and nothing in this package changes a stored analysis.
 *
 * Gated on the same extraction toggle as the analyses it reports on.
 */
@RestController
@RequestMapping("/analytics")
@ConditionalOnProperty(prefix = "modules.extraction", name = "enabled", havingValue = "true", matchIfMissing = true)
public class AnalyticsController {

    /** A year, so the dashboard opens on the whole demo set rather than an empty chart. */
    private static final int DEFAULT_WINDOW_DAYS = 365;

    /** Guards against a caller asking for a window so wide it means nothing. */
    private static final int MAX_WINDOW_DAYS = 3650;

    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    /**
     * @param days history to include; 0 means everything ever recorded.
     */
    @GetMapping("/overview")
    public AnalyticsOverview overview(
        @RequestParam(defaultValue = "" + DEFAULT_WINDOW_DAYS) int days) {
        return service.overview(Math.max(0, Math.min(days, MAX_WINDOW_DAYS)));
    }
}
