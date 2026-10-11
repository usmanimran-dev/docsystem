package com.edms.examination.controller;

import com.edms.examination.dto.CountryImportResult;
import com.edms.examination.dto.PortImportResult;
import com.edms.examination.model.HsCodePricing;
import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.model.SanctionedHsCode;
import com.edms.examination.model.SanctionedPort;
import com.edms.examination.service.ComplianceService;
import com.edms.examination.service.CountryImportService;
import com.edms.examination.service.EntityScreeningService;
import com.edms.examination.service.HsCodePricingService;
import com.edms.examination.service.HsCodeSanctionService;
import com.edms.examination.service.PortImportService;
import com.edms.examination.service.PortService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * This is the "one API, one URL" contract Imad described: whatever calls
 * this endpoint never knows or cares whether sanctions.source is "live"
 * (this service synced from the internet) or "local" (an admin imported
 * a file, no internet involved). The response shape is identical either
 * way - that decision lives entirely inside ComplianceService/the sync
 * job, never leaks out to callers.
 */
@RestController
@RequestMapping("/compliance")
@ConditionalOnProperty(prefix = "modules.compliance", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ComplianceController {

    private final ComplianceService complianceService;
    private final EntityScreeningService entityScreeningService;
    private final CountryImportService countryImportService;
    private final HsCodePricingService hsCodePricingService;
    private final HsCodeSanctionService hsCodeSanctionService;
    private final PortService portService;
    private final PortImportService portImportService;

    public ComplianceController(ComplianceService complianceService,
                                 EntityScreeningService entityScreeningService,
                                 CountryImportService countryImportService,
                                 HsCodePricingService hsCodePricingService,
                                 HsCodeSanctionService hsCodeSanctionService,
                                 PortService portService,
                                 PortImportService portImportService) {
        this.complianceService = complianceService;
        this.entityScreeningService = entityScreeningService;
        this.countryImportService = countryImportService;
        this.hsCodePricingService = hsCodePricingService;
        this.hsCodeSanctionService = hsCodeSanctionService;
        this.portService = portService;
        this.portImportService = portImportService;
    }

    @GetMapping("/check-country")
    public ResponseEntity<Map<String, Object>> checkCountry(@RequestParam String value) {
        Optional<SanctionedCountry> match = complianceService.checkCountry(value);

        if (match.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                "checked", value,
                "flagged", false,
                "checkedAt", Instant.now().toString()
            ));
        }

        SanctionedCountry country = match.get();
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("checked", value);
        result.put("flagged", true);
        result.put("isoCode", country.getIsoCode());
        result.put("name", country.getName());
        result.put("listType", country.getListType().name());
        result.put("tier", country.getTier().name());
        result.put("severity", severityFor(country.getTier()));
        result.put("message", messageFor(country));
        result.put("source", country.getSource());
        result.put("verifiedDate", country.getVerifiedDate());
        result.put("checkedAt", Instant.now().toString());
        return ResponseEntity.ok(result);
    }

    /**
     * OFAC and FATF entries are NOT equally severe and must not read the
     * same way - see SanctionedCountry.ListType. A FATF grey-list country
     * (e.g. Vietnam) is not sanctioned; calling it "critical" the same way
     * as Iran would misstate what's actually true.
     */
    private String severityFor(SanctionedCountry.Tier tier) {
        return switch (tier) {
            case COMPREHENSIVE, FATF_BLACKLIST, BANK_SANCTIONED -> "critical";
            case SECTORAL, FATF_GREYLIST, BANK_HIGH_RISK -> "warning";
        };
    }

    private String messageFor(SanctionedCountry country) {
        return switch (country.getListType()) {
            case OFAC_SANCTIONS -> country.getTier() == SanctionedCountry.Tier.COMPREHENSIVE
                ? country.getName() + " is under comprehensive OFAC sanctions"
                : country.getName() + " is under sectoral/targeted OFAC sanctions";
            case FATF_AML_RISK -> country.getTier() == SanctionedCountry.Tier.FATF_BLACKLIST
                ? country.getName() + " is a FATF high-risk jurisdiction (Call for Action) - not OFAC-sanctioned, but subject to counter-measures under FATF guidance"
                : country.getName() + " is on the FATF grey list (increased monitoring) - not sanctioned; requires enhanced due diligence";
            // Attributed to the bank's own list, not OFAC/FATF - the
            // classification came from their file, not from either
            // regulator, and the message says so rather than implying more
            // authority than the source actually has.
            case BANK_PROVIDED -> country.getTier() == SanctionedCountry.Tier.BANK_SANCTIONED
                ? country.getName() + " is flagged as sanctioned on the bank's own compliance list"
                : country.getName() + " is flagged as high-risk on the bank's own compliance list";
        };
    }

    @GetMapping("/countries")
    public ResponseEntity<List<SanctionedCountry>> listCountries() {
        return ResponseEntity.ok(complianceService.listAll());
    }

    /**
     * The bank's own country risk file. Merges into the existing table by
     * iso_code (updates a match, adds a new entry otherwise) rather than
     * replacing it - the OFAC/FATF entries seeded earlier stay unless the
     * bank's file happens to include the same country, in which case the
     * bank's classification wins for that entry.
     */
    @PostMapping("/countries/import")
    public ResponseEntity<?> importCountries(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        try {
            CountryImportResult result = countryImportService.importCsv(file);
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not read file: " + e.getMessage()));
        }
    }

    /** Real fuzzy name matching via OpenSanctions - see EntityScreeningService for the request/response shape. */
    @GetMapping("/check-entity")
    public ResponseEntity<Map<String, Object>> checkEntity(
            @RequestParam String name,
            @RequestParam(defaultValue = "Company") String schema) {
        return ResponseEntity.ok(entityScreeningService.checkEntity(name, schema));
    }

    /**
     * Same "one API" contract as check-country: the caller passes an HS code
     * and the price declared on the document, and gets back whether that
     * price falls inside the expected range - never mind whether the range
     * came from this table's seed data, a manual entry, or (once wired up)
     * Imad's pricing API. Per the 2026-09-07 meeting: this only flags for
     * review, it does not block - "warning generate kerna hai", no hard stop.
     */
    @GetMapping("/check-hscode-price")
    public ResponseEntity<Map<String, Object>> checkHsCodePrice(
            @RequestParam String hscode,
            @RequestParam double price) {
        Optional<HsCodePricing> match = hsCodePricingService.findByHsCode(hscode);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("checked", hscode);
        result.put("declaredPrice", price);

        if (match.isEmpty()) {
            result.put("found", false);
            result.put("flagged", false);
            result.put("message", "No pricing reference found for HS code " + hscode);
            result.put("checkedAt", Instant.now().toString());
            return ResponseEntity.ok(result);
        }

        HsCodePricing pricing = match.get();
        boolean underpriced = price < pricing.getMinPrice();
        boolean overpriced = price > pricing.getMaxPrice();
        boolean flagged = underpriced || overpriced;

        result.put("found", true);
        result.put("flagged", flagged);
        result.put("hsCode", pricing.getHsCode());
        result.put("description", pricing.getDescription());
        result.put("minPrice", pricing.getMinPrice());
        result.put("maxPrice", pricing.getMaxPrice());
        result.put("currency", pricing.getCurrency());

        if (flagged) {
            String direction = underpriced ? "UNDER" : "OVER";
            result.put("direction", direction);
            result.put("severity", "warning");
            result.put("message", underpriced
                ? String.format("Declared price %.2f %s is below the expected range (%.2f-%.2f %s) for HS code %s - possible under-invoicing",
                    price, pricing.getCurrency(), pricing.getMinPrice(), pricing.getMaxPrice(), pricing.getCurrency(), pricing.getHsCode())
                : String.format("Declared price %.2f %s is above the expected range (%.2f-%.2f %s) for HS code %s - possible over-invoicing",
                    price, pricing.getCurrency(), pricing.getMinPrice(), pricing.getMaxPrice(), pricing.getCurrency(), pricing.getHsCode()));
        }

        result.put("source", pricing.getSource());
        result.put("verifiedDate", pricing.getVerifiedDate());
        result.put("checkedAt", Instant.now().toString());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/hscode-pricing")
    public ResponseEntity<List<HsCodePricing>> listHsCodePricing() {
        return ResponseEntity.ok(hsCodePricingService.listAll());
    }

    /**
     * HS code + destination country export-control check, per Imad (senior
     * dev, 2026-09-17). A separate signal from check-hscode-price: that one
     * flags an implausible price, this one flags the trade itself as
     * restricted regardless of price - dual-use telecom equipment into Iran
     * is a compliance issue at any declared price.
     *
     * "country" here is the same free-text field the country-sanctions check
     * takes - HsCodeSanctionService resolves it via the existing
     * ComplianceService alias lookup rather than a new matching path.
     */
    @GetMapping("/check-hscode-sanction")
    public ResponseEntity<Map<String, Object>> checkHsCodeSanction(
            @RequestParam String hscode,
            @RequestParam String country) {
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("checked", hscode);
        result.put("checkedCountry", country);

        Optional<SanctionedHsCode> match = hsCodeSanctionService.check(hscode, country);
        if (match.isEmpty()) {
            result.put("flagged", false);
            result.put("checkedAt", Instant.now().toString());
            return ResponseEntity.ok(result);
        }

        SanctionedHsCode entry = match.get();
        boolean critical = entry.getLevel() == SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED;
        result.put("flagged", true);
        result.put("hsCode", entry.getHsCode());
        result.put("countryIsoCode", entry.getCountryIsoCode());
        result.put("countryName", entry.getCountryName());
        result.put("description", entry.getDescription());
        result.put("level", entry.getLevel().name());
        result.put("severity", critical ? "critical" : "warning");
        result.put("message", entry.getDescription() + " (HS " + entry.getHsCode() + ") is "
            + (critical ? "export-controlled" : "restricted") + " for " + entry.getCountryName()
            + " - " + entry.getReason());
        result.put("source", entry.getSource());
        result.put("verifiedDate", entry.getVerifiedDate());
        result.put("checkedAt", Instant.now().toString());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/hscode-sanctions")
    public ResponseEntity<List<SanctionedHsCode>> listHsCodeSanctions() {
        return ResponseEntity.ok(hsCodeSanctionService.listAll());
    }

    /**
     * Checks the port itself, directly, against SanctionedPort only.
     *
     * The country-derived check (UN/LOCODE's first two letters against
     * SanctionedCountry) is deliberately switched off per Imad (2026-09-14):
     * port risk must come from real per-port data (PortDataSeeder for
     * testing, or the bank's own CSV import), not be inferred just because
     * the port's country happens to be listed. PortService.checkPortCountry
     * still exists if this needs to come back - see its own comment.
     */
    @GetMapping("/check-port")
    public ResponseEntity<Map<String, Object>> checkPort(@RequestParam String value) {
        String unlocode = value.trim().toUpperCase();
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("checked", unlocode);

        Optional<SanctionedPort> portMatch = portService.checkBankFlaggedPort(unlocode);
        if (portMatch.isPresent()) {
            SanctionedPort port = portMatch.get();
            String severity = severityForPort(port.getTier());
            result.put("flagged", true);
            result.put("reason", "PORT_SANCTIONED");
            result.put("portName", port.getPortName());
            result.put("tier", port.getTier().name());
            result.put("severity", severity);
            result.put("message", port.getPortName() + " (" + unlocode + ") is "
                + (port.getTier() == SanctionedPort.Tier.SANCTIONED ? "directly sanctioned" : "flagged as a high-risk port")
                + " on record");
            result.put("source", port.getSource());
            result.put("verifiedDate", port.getVerifiedDate());
            result.put("checkedAt", Instant.now().toString());
            return ResponseEntity.ok(result);
        }

        result.put("flagged", false);
        result.put("checkedAt", Instant.now().toString());
        return ResponseEntity.ok(result);
    }

    private String severityForPort(SanctionedPort.Tier tier) {
        return tier == SanctionedPort.Tier.SANCTIONED ? "critical" : "warning";
    }

    @GetMapping("/ports")
    public ResponseEntity<List<SanctionedPort>> listPorts() {
        return ResponseEntity.ok(portService.listAll());
    }

    /** Bank-provided high-risk port list. Merges by unlocode, same as country import. */
    @PostMapping("/ports/import")
    public ResponseEntity<?> importPorts(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        try {
            PortImportResult result = portImportService.importCsv(file);
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Could not read file: " + e.getMessage()));
        }
    }
}
