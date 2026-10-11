package com.edms.examination.service;

import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.model.SanctionedPort;
import com.edms.examination.repository.SanctionedCountryRepository;
import com.edms.examination.repository.SanctionedPortRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Port risk lookups. Two methods exist for two different signals, but only
 * one is wired into ComplianceController.checkPort right now:
 *
 *   1. checkBankFlaggedPort - the port ITSELF, directly, against
 *      SanctionedPort (seeded sample data or bank CSV import). This is the
 *      only check ComplianceController currently calls.
 *
 *   2. checkPortCountry - derives risk from the port's COUNTRY (UN/LOCODE's
 *      first two letters, the ISO country code by definition of the
 *      standard) against SanctionedCountry. DISABLED per Imad (2026-09-14):
 *      port risk must come from real per-port data, not be inferred just
 *      because the country happens to be listed. Left in place, unused, in
 *      case that decision reverses - not called from anywhere currently.
 */
@Service
public class PortService {

    private final SanctionedPortRepository portRepository;
    private final SanctionedCountryRepository countryRepository;

    public PortService(SanctionedPortRepository portRepository, SanctionedCountryRepository countryRepository) {
        this.portRepository = portRepository;
        this.countryRepository = countryRepository;
    }

    /** Extracts the ISO country code from a UN/LOCODE and checks it against SanctionedCountry. */
    public Optional<SanctionedCountry> checkPortCountry(String unlocode) {
        String countryCode = countryCodeFrom(unlocode);
        if (countryCode == null) {
            return Optional.empty();
        }
        return countryRepository.findByIsoCode(countryCode);
    }

    /** Direct lookup against the bank-provided high-risk port table. */
    public Optional<SanctionedPort> checkBankFlaggedPort(String unlocode) {
        if (unlocode == null || unlocode.isBlank()) {
            return Optional.empty();
        }
        return portRepository.findByUnlocode(unlocode.trim().toUpperCase());
    }

    public List<SanctionedPort> listAll() {
        return portRepository.findAll();
    }

    /** UN/LOCODE = 2-letter ISO country code + 3-letter location code, always. */
    private String countryCodeFrom(String unlocode) {
        if (unlocode == null || unlocode.trim().length() < 2) {
            return null;
        }
        return unlocode.trim().substring(0, 2).toUpperCase();
    }
}
