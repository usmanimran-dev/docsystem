package com.edms.examination.controller;

import com.edms.examination.service.VesselTrackingService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Data Docked passthrough endpoints - deliberately raw/diagnostic for now
 * (see VesselTrackingService). Once a real call confirms the actual response
 * shape, /check-route gets added here to do the real route-deviation
 * comparison against a BOL's declared Port of Loading/Discharge (which
 * Document Reader already extracts) - not built yet, this is step one.
 */
@RestController
@RequestMapping("/vessel")
@ConditionalOnProperty(prefix = "modules.vesseltracking", name = "enabled", havingValue = "true", matchIfMissing = true)
public class VesselController {

    private final VesselTrackingService vesselTrackingService;

    public VesselController(VesselTrackingService vesselTrackingService) {
        this.vesselTrackingService = vesselTrackingService;
    }

    /** 1 credit. Raw response - shape not yet confirmed, see class-level note. */
    @GetMapping("/port-calls")
    public ResponseEntity<Map<String, Object>> portCalls(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.getPortCallHistory(imo));
    }

    /** 1 credit. Raw response. */
    @GetMapping("/location")
    public ResponseEntity<Map<String, Object>> location(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.getLocation(imo));
    }

    /** 1 credit. Raw response. */
    @GetMapping("/particulars")
    public ResponseEntity<Map<String, Object>> particulars(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.getParticulars(imo));
    }

    /** 1 credit. Raw response - owner/manager company data. */
    @GetMapping("/management")
    public ResponseEntity<Map<String, Object>> management(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.getManagementData(imo));
    }

    /**
     * 1 credit (one get-vessel-location call). Route deviation check per the
     * 2026-09-08/09 discussion - see VesselTrackingService.checkRouteDeviation
     * for what this does and does not catch.
     */
    @GetMapping("/check-route")
    public ResponseEntity<Map<String, Object>> checkRoute(
            @RequestParam String imo,
            @RequestParam String portOfLoading,
            @RequestParam String portOfDischarge) {
        return ResponseEntity.ok(vesselTrackingService.checkRouteDeviation(imo, portOfLoading, portOfDischarge));
    }

    /**
     * 1 credit. Flag State Check (Imad confirmed 2026-09-08) - reuses the
     * existing Country Sanctions table, no new module.
     */
    @GetMapping("/check-flag")
    public ResponseEntity<Map<String, Object>> checkFlag(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.checkFlagState(imo));
    }

    /**
     * 1 Data Docked credit + up to 2 OpenSanctions requests (50/month quota).
     * Ownership/Management Screening (Imad confirmed 2026-09-08) - reuses the
     * existing Entity Screening module, no new module.
     */
    @GetMapping("/check-ownership")
    public ResponseEntity<Map<String, Object>> checkOwnership(@RequestParam String imo) {
        return ResponseEntity.ok(vesselTrackingService.checkOwnership(imo));
    }

    /**
     * ⚠️ 15 CREDITS per call - the most expensive endpoint in this service.
     * Diagnostic/raw only, not wired into any automatic check. Call this
     * ONLY with explicit confirmation from whoever is watching the credit
     * balance - see VesselTrackingService.getBanListRaw().
     */
    @GetMapping("/ban-list-raw")
    public ResponseEntity<Map<String, Object>> banListRaw() {
        return ResponseEntity.ok(vesselTrackingService.getBanListRaw());
    }
}
