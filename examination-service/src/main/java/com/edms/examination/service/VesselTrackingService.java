package com.edms.examination.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.edms.examination.model.SanctionedCountry;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Data Docked (https://datadocked.com) vessel API - live AIS/port-call data
 * per the 2026-09-08/09 vessel tracking discussion. Same config pattern as
 * EntityScreeningService (DATADOCKED_API_KEY env var, never committed).
 *
 * get-vessel-location's response shape is confirmed against a REAL call
 * (2026-09-09, IMO 9247431):
 *   { "name", "imo", "lastPort", "destination",
 *     "unlocodeLastport", "unlocodeDestination", "latitude", ... }
 * Note the published docs example wraps all of that in a "detail" object -
 * the live API does not. Trusting the docs here would have silently
 * returned "no data" for every vessel, which is exactly what the first
 * test call caught. Parsing below accepts both shapes.
 * port-calls-by-vessel's shape is still NOT confirmed - no example was
 * published for it, and getPortCallHistory() below stays a raw passthrough
 * until a real call (real credit) tells us the actual field names. That's
 * also why checkRouteDeviation() below deliberately uses ONLY
 * get-vessel-location's confirmed lastPort/destination fields rather than
 * waiting on port-calls-by-vessel's full history.
 */
@Service
public class VesselTrackingService {

    private final RestTemplate restTemplate;
    private final ComplianceService complianceService;
    private final EntityScreeningService entityScreeningService;

    @Value("${datadocked.api.url}")
    private String apiUrl;

    @Value("${datadocked.api.key:}")
    private String apiKey;

    public VesselTrackingService(RestTemplate restTemplate,
                                  ComplianceService complianceService,
                                  EntityScreeningService entityScreeningService) {
        this.restTemplate = restTemplate;
        this.complianceService = complianceService;
        this.entityScreeningService = entityScreeningService;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /** 1 credit/call. Historical port visits for a vessel. */
    public Map<String, Object> getPortCallHistory(String imoOrMmsi) {
        return get("port-calls-by-vessel", imoOrMmsi);
    }

    /** 1 credit/call. Real-time position. */
    public Map<String, Object> getLocation(String imoOrMmsi) {
        return get("get-vessel-location", imoOrMmsi);
    }

    /** 1 credit/call. Name, type, flag, built year, etc. */
    public Map<String, Object> getParticulars(String imoOrMmsi) {
        return get("get-vessel-particulars", imoOrMmsi);
    }

    /** 1 credit/call. Registered owner / manager / operator company details. */
    public Map<String, Object> getManagementData(String imoOrMmsi) {
        return get("get-vessel-management-data", imoOrMmsi);
    }

    /**
     * Route deviation signal (2026-09-08/09 discussion, Imad's China→Pakistan-
     * via-Dubai example) - built on get-vessel-location's CONFIRMED
     * lastPort/destination fields, deliberately not port-calls-by-vessel's
     * unconfirmed full history. Compares the vessel's actual last-visited
     * port and current destination against the BOL's declared Port of
     * Loading/Discharge (which Document Reader already extracts).
     *
     * Catches the case where the vessel has already left an unscheduled
     * stop: unlocodeLastport would show that stop, not the declared loading
     * port. Does NOT catch a deviation from earlier in a multi-leg voyage
     * that a later leg has since superseded - this only sees the
     * immediately-preceding port and current destination, not full history.
     * That gap is exactly what port-calls-by-vessel would close, once its
     * shape is confirmed.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkRouteDeviation(String imo, String declaredLoadingPort, String declaredDischargePort) {
        Map<String, Object> response = getLocation(imo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checked", imo);
        result.put("declaredPortOfLoading", declaredLoadingPort);
        result.put("declaredPortOfDischarge", declaredDischargePort);

        // The published docs example wraps the vessel fields in "detail", but
        // the live API (verified 2026-09-09, IMO 9247431) returns them at the
        // top level with no wrapper. Handle both rather than trusting either.
        Map<String, Object> detail = response.get("detail") instanceof Map
            ? (Map<String, Object>) response.get("detail")
            : response;

        if (detail.get("unlocodeLastport") == null && detail.get("unlocodeDestination") == null) {
            result.put("flagged", false);
            result.put("error", response.getOrDefault("error", "No location data available for this vessel"));
            return result;
        }

        String actualLastPortCode = asString(detail.get("unlocodeLastport"));
        String actualDestinationCode = asString(detail.get("unlocodeDestination"));

        result.put("vesselName", detail.get("name"));
        result.put("actualLastPort", detail.get("lastPort"));
        result.put("actualLastPortUnlocode", actualLastPortCode);
        result.put("actualDestination", detail.get("destination"));
        result.put("actualDestinationUnlocode", actualDestinationCode);

        boolean loadingMismatch = declaredLoadingPort != null && actualLastPortCode != null
            && !declaredLoadingPort.equalsIgnoreCase(actualLastPortCode);
        boolean dischargeMismatch = declaredDischargePort != null && actualDestinationCode != null
            && !declaredDischargePort.equalsIgnoreCase(actualDestinationCode);

        result.put("flagged", loadingMismatch || dischargeMismatch);
        result.put("loadingMismatch", loadingMismatch);
        result.put("dischargeMismatch", dischargeMismatch);

        if (loadingMismatch) {
            result.put("loadingMessage", "Vessel's last visited port (" + actualLastPortCode
                + ") does not match the declared Port of Loading (" + declaredLoadingPort
                + ") - possible unscheduled stop before this leg");
        }
        if (dischargeMismatch) {
            result.put("dischargeMessage", "Vessel's current destination (" + actualDestinationCode
                + ") does not match the declared Port of Discharge (" + declaredDischargePort
                + ") - route may have changed");
        }

        return result;
    }

    /**
     * Flag State Check (Imad confirmed 2026-09-08: "Yes aisa hi hai").
     *
     * A vessel's flag state is the country it's registered under, which is a
     * separate question from whether the vessel itself is on a ban list -
     * dark-fleet ships routinely re-flag to a "clean" registry precisely to
     * dodge flag-based screening, so both checks have to exist independently.
     *
     * Reuses the SAME SanctionedCountry table the country/port checks use -
     * no new module, per Imad. 1 Data Docked credit (get-vessel-particulars),
     * whose response gives a proper ISO code ("countryIso": "CM"), so this is
     * an exact code lookup with no alias matching needed.
     */
    public Map<String, Object> checkFlagState(String imo) {
        Map<String, Object> particulars = getParticulars(imo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checked", imo);

        String isoCode = asString(particulars.get("countryIso"));
        String countryName = asString(particulars.get("country"));

        if (isoCode == null && countryName == null) {
            result.put("flagged", false);
            result.put("error", particulars.getOrDefault("error", "No vessel particulars available"));
            return result;
        }

        result.put("vesselName", particulars.get("name"));
        result.put("flagCountry", countryName);
        result.put("flagCountryIso", isoCode);

        Optional<SanctionedCountry> match = complianceService.checkCountryByIsoCode(isoCode);
        if (match.isEmpty()) {
            result.put("flagged", false);
            return result;
        }

        SanctionedCountry country = match.get();
        result.put("flagged", true);
        result.put("tier", country.getTier().name());
        result.put("listType", country.getListType().name());
        result.put("severity", severityFor(country.getTier()));
        result.put("message", "Vessel is flagged (registered) in " + country.getName()
            + ", which is on the compliance list - " + country.getTier().name());
        result.put("source", country.getSource());
        result.put("verifiedDate", country.getVerifiedDate());
        return result;
    }

    /**
     * Ownership/Management Screening (Imad confirmed 2026-09-08: "Han..").
     *
     * Screens the vessel's registered owner AND its manager - deliberately
     * both, because they are frequently different companies and a sanctioned
     * party can sit behind either one. Reuses the existing OpenSanctions
     * EntityScreeningService, per Imad - no new module.
     *
     * Cost: 1 Data Docked credit (get-vessel-management-data) PLUS up to 2
     * OpenSanctions requests against that service's own 50/month trial quota.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkOwnership(String imo) {
        Map<String, Object> data = getManagementData(imo);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("checked", imo);
        result.put("vesselName", data.get("name"));

        // Unlike get-vessel-location/particulars (flat), this endpoint DOES
        // nest its fields under "management" - verified against a real call
        // 2026-09-10. Every endpoint here has a different shape; none of them
        // can be assumed from another.
        Object mgmtObj = data.get("management");
        if (!(mgmtObj instanceof Map)) {
            result.put("flagged", false);
            result.put("error", data.getOrDefault("error", "No management data available for this vessel"));
            return result;
        }

        Map<String, Object> mgmt = (Map<String, Object>) mgmtObj;
        String registeredOwner = cleanName(mgmt.get("registeredOwner"));
        String manager = cleanName(mgmt.get("manager"));

        result.put("registeredOwner", registeredOwner);
        result.put("manager", manager);

        List<Map<String, Object>> screened = new java.util.ArrayList<>();
        boolean anySanctionHit = false;
        boolean anyOtherHit = false;
        int screenedOk = 0;
        int screenedError = 0;

        for (Map.Entry<String, String> party : partiesToScreen(registeredOwner, manager).entrySet()) {
            Map<String, Object> entityResult = entityScreeningService.checkEntity(party.getValue(), "Company");
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("role", party.getKey());
            entry.put("name", party.getValue());
            entry.put("hasMatch", entityResult.get("hasMatch"));
            entry.put("candidates", entityResult.get("candidates"));

            if (entityResult.containsKey("error")) {
                entry.put("error", entityResult.get("error"));
                screenedError++;
            } else {
                screenedOk++;
                if (Boolean.TRUE.equals(entityResult.get("hasMatch"))) {
                    if (hasSanctionTopic((List<Map<String, Object>>) entityResult.get("candidates"))) {
                        anySanctionHit = true;
                    } else {
                        anyOtherHit = true;
                    }
                }
            }
            screened.add(entry);
        }

        result.put("screened", screened);

        // Every party failed to actually screen (e.g. OPENSANCTIONS_API_KEY
        // missing) - nothing was verified, so this must NOT report the same
        // "flagged": false shape as a genuine clean result. Same reasoning as
        // checkRouteDeviation/checkFlagState's top-level "error" field -
        // without this, a check that never ran looked identical to a PASS.
        if (screenedOk == 0 && screenedError > 0) {
            result.put("flagged", false);
            String reasons = screened.stream()
                .map(e -> e.get("role") + ": " + e.get("error"))
                .reduce((a, b) -> a + "; " + b)
                .orElse("screening did not run");
            result.put("error", reasons);
            return result;
        }

        boolean anyHit = anySanctionHit || anyOtherHit;
        result.put("flagged", anyHit);

        // A hit on an actual sanctions/debarment/PEP topic is a different
        // claim than a hit on, say, a port-state-control detention dataset -
        // Maersk A/S turning up in tokyo_mou_detention is routine, not a
        // sanctions signal. Conflating the two would be the same category of
        // overclaiming as the "Miranda Shipping" substring bug, just one
        // level up (dataset-level instead of string-level). Only a real
        // sanctions-topic hit gets called "sanctions watchlist" / critical.
        if (anySanctionHit) {
            result.put("severity", "critical");
            result.put("message", "Vessel ownership/management matched a sanctions watchlist - review required");
        } else if (anyOtherHit) {
            result.put("severity", "warning");
            result.put("message", "Vessel ownership/management matched a non-sanctions watchlist entry "
                + "(e.g. a port state control detention record) - not confirmed as sanctioned, review recommended");
        }
        return result;
    }

    /**
     * OpenSanctions tags entries with a real policy classification via
     * "topics" (sanction, debarment, export.control, wanted, role.pep, ...).
     * A match with no sanction-related topic - just membership in a
     * detention/other dataset - is not a sanctions hit and must not be
     * worded as one.
     */
    @SuppressWarnings("unchecked")
    private boolean hasSanctionTopic(List<Map<String, Object>> candidates) {
        if (candidates == null) return false;
        for (Map<String, Object> c : candidates) {
            if (!Boolean.TRUE.equals(c.get("isMatch"))) continue;
            Object topicsObj = c.get("topics");
            if (!(topicsObj instanceof List)) continue;
            for (Object t : (List<Object>) topicsObj) {
                String topic = String.valueOf(t);
                if (topic.contains("sanction") || topic.equals("debarment") || topic.equals("wanted")
                    || topic.startsWith("export.control") || topic.startsWith("asset.freeze")) {
                    return true;
                }
            }
        }
        return false;
    }

    /** Data Docked uses "-" and "" as its empty markers, not null. */
    private String cleanName(Object o) {
        String s = asString(o);
        if (s == null) return null;
        s = s.trim();
        return (s.isEmpty() || "-".equals(s)) ? null : s;
    }

    private Map<String, String> partiesToScreen(String registeredOwner, String manager) {
        Map<String, String> parties = new LinkedHashMap<>();
        if (registeredOwner != null) {
            parties.put("registeredOwner", registeredOwner);
        }
        // Only screen the manager separately when it is actually a different
        // company - otherwise this burns a second OpenSanctions request from
        // a 50/month quota to ask the identical question twice.
        if (manager != null && !manager.equalsIgnoreCase(registeredOwner)) {
            parties.put("manager", manager);
        }
        return parties;
    }

    /** Same tier→severity mapping ComplianceController uses for countries. */
    private String severityFor(SanctionedCountry.Tier tier) {
        return switch (tier) {
            case COMPREHENSIVE, FATF_BLACKLIST, BANK_SANCTIONED -> "critical";
            case SECTORAL, FATF_GREYLIST, BANK_HIGH_RISK -> "warning";
        };
    }

    private String asString(Object o) {
        return o != null ? o.toString() : null;
    }

    /**
     * 15 credits - by far the most expensive call in this service (the
     * 20-credit trial budget barely covers one). Deliberately NOT called
     * automatically anywhere, and deliberately raw/unparsed: "get-vessels-
     * ban-list" (plural) suggests a bulk list, unlike every other endpoint
     * here which takes an imo_or_mmsi - but no example response was
     * published for it either, so this stays a diagnostic passthrough until
     * a real (paid) call confirms the shape. Once confirmed, the plan (see
     * FEATURES.md Phase 3) is to cache the result in our own MongoDB - same
     * pattern as SanctionedCountry/SanctionedPort - so every subsequent IMO
     * check is a free local lookup, not a repeat 15-credit call.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getBanListRaw() {
        if (!isConfigured()) {
            return Map.of(
                "screened", false,
                "error", "DATADOCKED_API_KEY not configured - no call made, no credit spent"
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        String url = apiUrl + "/get-vessels-ban-list";
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);

        Map<String, Object> body = response.getBody();
        return body != null ? body : Map.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String endpoint, String imoOrMmsi) {
        if (!isConfigured()) {
            return Map.of(
                "checked", imoOrMmsi,
                "screened", false,
                "error", "DATADOCKED_API_KEY not configured - no call made, no credit spent"
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", apiKey);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        String url = apiUrl + "/" + endpoint + "?imo_or_mmsi=" + imoOrMmsi;
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);

        Map<String, Object> body = response.getBody();
        return body != null ? body : Map.of();
    }
}
