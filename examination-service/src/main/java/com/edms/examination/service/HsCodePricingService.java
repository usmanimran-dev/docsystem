package com.edms.examination.service;

import com.edms.examination.model.HsCodePricing;
import com.edms.examination.repository.HsCodePricingRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class HsCodePricingService {

    private final HsCodePricingRepository repository;

    public HsCodePricingService(HsCodePricingRepository repository) {
        this.repository = repository;
    }

    /**
     * Exact match on HS code, same reasoning as ComplianceService.checkCountry -
     * a curated reference table, not a fuzzy-match target.
     */
    public Optional<HsCodePricing> findByHsCode(String hsCode) {
        if (hsCode == null || hsCode.isBlank()) {
            return Optional.empty();
        }
        return repository.findByHsCode(hsCode.trim());
    }

    public List<HsCodePricing> listAll() {
        return repository.findAll();
    }
}
