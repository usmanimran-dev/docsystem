package com.edms.examination.service;

import com.edms.examination.dto.PortImportResult;
import com.edms.examination.dto.PortImportRow;
import com.edms.examination.model.SanctionedPort;
import com.edms.examination.repository.SanctionedPortRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Imports a bank-provided sanctioned/high-risk port list - same
 * "merge, don't replace" behaviour as CountryImportService, and the same
 * reason for it: a bad row shouldn't silently drop what's already there.
 *
 * Expected CSV columns (header row required):
 *   unlocode   - 5-character UN/LOCODE, e.g. "AEJEA" (Jebel Ali). The first
 *                two letters are the ISO country code by definition of the
 *                standard - PortService ALSO checks that against
 *                SanctionedCountry independently, so a port doesn't need an
 *                entry here just because its country happens to be listed.
 *   port_name  - display name, e.g. "Jebel Ali"
 *   category   - "SANCTIONED" or "HIGH_RISK" (case-insensitive), same
 *                two values CountryImportService accepts - per Imad
 *                (2026-09-14), a port itself can now be directly sanctioned
 *                in this table, not just derived from its country.
 */
@Service
public class PortImportService {

    private final SanctionedPortRepository repository;

    public PortImportService(SanctionedPortRepository repository) {
        this.repository = repository;
    }

    public PortImportResult importCsv(MultipartFile file) throws IOException {
        List<PortImportRow> rows = new ArrayList<>();
        int added = 0;
        int updated = 0;
        int skipped = 0;

        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                 .setHeader()
                 .setSkipHeaderRecord(true)
                 .setIgnoreSurroundingSpaces(true)
                 .setTrim(true)
                 .build()
                 .parse(reader)) {

            for (CSVRecord record : parser) {
                int lineNumber = (int) record.getRecordNumber() + 1;

                try {
                    PortImportRow outcome = importRow(record, lineNumber);
                    rows.add(outcome);
                    switch (outcome.getOutcome()) {
                        case "ADDED" -> added++;
                        case "UPDATED" -> updated++;
                        default -> skipped++;
                    }
                } catch (Exception rowError) {
                    skipped++;
                    rows.add(new PortImportRow(lineNumber, safeGet(record, "unlocode"),
                        "SKIPPED", "Unexpected error: " + rowError.getMessage()));
                }
            }
        }

        return new PortImportResult(
            file.getOriginalFilename(), Instant.now(),
            rows.size(), added, updated, skipped, rows
        );
    }

    private PortImportRow importRow(CSVRecord record, int lineNumber) {
        String unlocode = safeGet(record, "unlocode");
        String portName = safeGet(record, "port_name");
        String categoryRaw = safeGet(record, "category");

        if (unlocode == null || unlocode.isBlank()) {
            return new PortImportRow(lineNumber, unlocode, "SKIPPED", "unlocode is required");
        }
        if (unlocode.trim().length() != 5) {
            return new PortImportRow(lineNumber, unlocode, "SKIPPED",
                "unlocode must be 5 characters (2-letter country + 3-letter location), got: '" + unlocode + "'");
        }
        if (portName == null || portName.isBlank()) {
            return new PortImportRow(lineNumber, unlocode, "SKIPPED", "port_name is required");
        }

        SanctionedPort.Tier tier = mapCategory(categoryRaw);
        if (tier == null) {
            return new PortImportRow(lineNumber, unlocode, "SKIPPED",
                "category must be SANCTIONED or HIGH_RISK, got: '" + categoryRaw + "'");
        }

        String unlocodeNormalized = unlocode.trim().toUpperCase();
        boolean isUpdate = repository.findByUnlocode(unlocodeNormalized).isPresent();

        SanctionedPort entity = repository.findByUnlocode(unlocodeNormalized).orElseGet(SanctionedPort::new);
        entity.setUnlocode(unlocodeNormalized);
        entity.setPortName(portName.trim());
        entity.setTier(tier);
        entity.setSource("Bank-provided compliance data");
        entity.setVerifiedDate(LocalDate.now().toString());

        repository.save(entity);

        return new PortImportRow(lineNumber, unlocodeNormalized, isUpdate ? "UPDATED" : "ADDED", null);
    }

    private SanctionedPort.Tier mapCategory(String categoryRaw) {
        if (categoryRaw == null) return null;
        return switch (categoryRaw.trim().toUpperCase()) {
            case "SANCTIONED" -> SanctionedPort.Tier.SANCTIONED;
            case "HIGH_RISK" -> SanctionedPort.Tier.HIGH_RISK;
            default -> null;
        };
    }

    private String safeGet(CSVRecord record, String column) {
        try {
            return record.isMapped(column) ? record.get(column) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
