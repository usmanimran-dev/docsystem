package com.edms.examination.service;

import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.repository.SanctionedCountryRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ComplianceService {

    private final SanctionedCountryRepository repository;

    public ComplianceService(SanctionedCountryRepository repository) {
        this.repository = repository;
    }

    /**
     * Exact match only against known aliases - deliberately not fuzzy.
     * A short, curated country list doesn't need it, and fuzzy matching
     * is what caused the "Miranda Shipping" false positive in the
     * frontend-only prototype this replaces.
     */
    public Optional<SanctionedCountry> checkCountry(String extractedText) {
        if (extractedText == null || extractedText.isBlank()) {
            return Optional.empty();
        }
        String normalized = extractedText.trim().toLowerCase();

        return repository.findAll().stream()
            .filter(country -> country.getAliases().stream()
                .anyMatch(alias -> alias.toLowerCase().equals(normalized)))
            .findFirst();
    }

    /**
     * Exact ISO-code lookup, for callers that already hold a country code
     * rather than free text - e.g. a vessel's flag state, which Data Docked
     * returns as a proper ISO code ("CM"), so there is nothing to alias-match.
     */
    public Optional<SanctionedCountry> checkCountryByIsoCode(String isoCode) {
        if (isoCode == null || isoCode.isBlank()) {
            return Optional.empty();
        }
        return repository.findByIsoCode(isoCode.trim().toUpperCase());
    }

    public List<SanctionedCountry> listAll() {
        return repository.findAll();
    }
}
