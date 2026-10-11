package com.edms.examination.service;

import com.edms.examination.dto.CountryImportResult;
import com.edms.examination.dto.CountryImportRow;
import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.repository.SanctionedCountryRepository;
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
import java.util.Arrays;
import java.util.List;

/**
 * Imports a bank-provided country risk list.
 *
 * Expected CSV columns (header row required):
 *   iso_code    - 2-letter country code, e.g. "IR"
 *   country_name - display name, e.g. "Iran"
 *   category    - "SANCTIONED" or "HIGH_RISK" (case-insensitive)
 *   aliases     - optional, semicolon-separated name variants. Falls back
 *                 to just country_name if left blank.
 *
 * Existing entries (matched by iso_code) are updated in place rather than
 * duplicated - see the "merge, don't replace" decision this was built
 * against. Every row's outcome (added/updated/skipped + why) is reported
 * back rather than only a total count, so a bad row doesn't fail silently
 * inside a batch that otherwise succeeded.
 */
@Service
public class CountryImportService {

    private final SanctionedCountryRepository repository;

    public CountryImportService(SanctionedCountryRepository repository) {
        this.repository = repository;
    }

    public CountryImportResult importCsv(MultipartFile file) throws IOException {
        List<CountryImportRow> rows = new ArrayList<>();
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
                // +2: CSVRecord's row number is 0-based after the header,
                // this reports the line a human would count in the actual file.
                int lineNumber = (int) record.getRecordNumber() + 1;

                try {
                    CountryImportRow outcome = importRow(record, lineNumber);
                    rows.add(outcome);
                    switch (outcome.getOutcome()) {
                        case "ADDED" -> added++;
                        case "UPDATED" -> updated++;
                        default -> skipped++;
                    }
                } catch (Exception rowError) {
                    skipped++;
                    rows.add(new CountryImportRow(lineNumber, safeGet(record, "iso_code"),
                        "SKIPPED", "Unexpected error: " + rowError.getMessage()));
                }
            }
        }

        return new CountryImportResult(
            file.getOriginalFilename(), Instant.now(),
            rows.size(), added, updated, skipped, rows
        );
    }

    private CountryImportRow importRow(CSVRecord record, int lineNumber) {
        String isoCode = safeGet(record, "iso_code");
        String name = safeGet(record, "country_name");
        String categoryRaw = safeGet(record, "category");
        String aliasesRaw = safeGet(record, "aliases");

        if (isoCode == null || isoCode.isBlank()) {
            return new CountryImportRow(lineNumber, isoCode, "SKIPPED", "iso_code is required");
        }
        if (name == null || name.isBlank()) {
            return new CountryImportRow(lineNumber, isoCode, "SKIPPED", "country_name is required");
        }

        SanctionedCountry.Tier tier = mapCategory(categoryRaw);
        if (tier == null) {
            return new CountryImportRow(lineNumber, isoCode, "SKIPPED",
                "category must be SANCTIONED or HIGH_RISK, got: '" + categoryRaw + "'");
        }

        List<String> aliases = (aliasesRaw == null || aliasesRaw.isBlank())
            ? List.of(name)
            : Arrays.stream(aliasesRaw.split(";")).map(String::trim).filter(s -> !s.isEmpty()).toList();

        String isoNormalized = isoCode.trim().toUpperCase();
        boolean isUpdate = repository.findByIsoCode(isoNormalized).isPresent();

        SanctionedCountry entity = repository.findByIsoCode(isoNormalized).orElseGet(SanctionedCountry::new);
        entity.setIsoCode(isoNormalized);
        entity.setName(name.trim());
        entity.setAliases(aliases);
        entity.setTier(tier);
        entity.setListType(SanctionedCountry.ListType.BANK_PROVIDED);
        entity.setSource("Bank-provided compliance data");
        entity.setVerifiedDate(LocalDate.now().toString());

        repository.save(entity);

        return new CountryImportRow(lineNumber, isoNormalized, isUpdate ? "UPDATED" : "ADDED", null);
    }

    private SanctionedCountry.Tier mapCategory(String categoryRaw) {
        if (categoryRaw == null) return null;
        return switch (categoryRaw.trim().toUpperCase()) {
            case "SANCTIONED" -> SanctionedCountry.Tier.BANK_SANCTIONED;
            case "HIGH_RISK" -> SanctionedCountry.Tier.BANK_HIGH_RISK;
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
