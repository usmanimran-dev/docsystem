package com.edms.examination.service;

import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.model.SanctionedHsCode;
import com.edms.examination.repository.SanctionedHsCodeRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * HS code + destination country export-control check. Per Imad (senior dev,
 * 2026-09-17): a separate signal from {@link HsCodePricingService}, which
 * only flags an implausible declared price - this flags the trade itself as
 * restricted regardless of price, e.g. dual-use telecom equipment into Iran.
 *
 * Country resolution deliberately reuses {@link ComplianceService#checkCountry}
 * rather than inventing new free-text matching here - same exact-alias
 * lookup the country-sanctions check already uses. A consequence worth
 * knowing: if the extracted country isn't already in the SanctionedCountry
 * table at all, it can't be resolved to an ISO code, so a combination
 * against an otherwise-unlisted country can never be found even if it
 * exists in this table. Acceptable for now because every current seed entry
 * pairs with a country (Iran/Russia/North Korea) that's already listed
 * there - re-visit if that stops being true.
 */
@Service
public class HsCodeSanctionService {

    private final SanctionedHsCodeRepository repository;
    private final ComplianceService complianceService;

    public HsCodeSanctionService(SanctionedHsCodeRepository repository, ComplianceService complianceService) {
        this.repository = repository;
        this.complianceService = complianceService;
    }

    public Optional<SanctionedHsCode> check(String hsCode, String extractedCountryText) {
        if (hsCode == null || hsCode.isBlank() || extractedCountryText == null || extractedCountryText.isBlank()) {
            return Optional.empty();
        }

        Optional<SanctionedCountry> countryMatch = complianceService.checkCountry(extractedCountryText);
        if (countryMatch.isEmpty()) {
            return Optional.empty();
        }

        return repository.findByHsCodeAndCountryIsoCode(hsCode.trim(), countryMatch.get().getIsoCode());
    }

    public java.util.List<SanctionedHsCode> listAll() {
        return repository.findAll();
    }
}
