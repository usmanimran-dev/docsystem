package com.edms.examination.controller;

import com.edms.examination.dto.DiscrepancyCheckRequest;
import com.edms.examination.dto.DiscrepancyReportResponse;
import com.edms.examination.model.DiscrepancyReport;
import com.edms.examination.service.DiscrepancyService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Cross-document discrepancy checking.
 *
 * Gated on the same extraction toggle as the analyses it reads - there is
 * nothing to compare when extraction is switched off.
 */
@RestController
@RequestMapping("/discrepancy")
@ConditionalOnProperty(prefix = "modules.extraction", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DiscrepancyController {

    private final DiscrepancyService service;

    public DiscrepancyController(DiscrepancyService service) {
        this.service = service;
    }

    @PostMapping("/check")
    @ResponseStatus(HttpStatus.CREATED)
    public DiscrepancyReportResponse check(@Valid @RequestBody DiscrepancyCheckRequest request) {
        return service.check(request);
    }

    @GetMapping("/{id}")
    public DiscrepancyReportResponse getById(@PathVariable String id) {
        return service.getById(id);
    }

    @GetMapping("/by-lc/{lcReference}")
    public List<DiscrepancyReport> findByLcReference(@PathVariable String lcReference) {
        return service.findByLcReference(lcReference);
    }
}
