package com.edms.examination.config;

import com.edms.examination.model.SanctionedHsCode;
import com.edms.examination.repository.SanctionedHsCodeRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds a small set of illustrative HS code + country export-control
 * combinations on first boot, so the check works out of the box - same
 * "placeholder, not authoritative" status as HsCodePricingSeeder and
 * PortDataSeeder's sample data.
 *
 * PLACEHOLDER DATA - these are illustrative examples of real-world control
 * categories (dual-use telecom/electronics, oil & gas equipment, nuclear
 * materials, military articles), not sourced from an actual denied-party or
 * commerce-control list. Replace with a real source (US Commerce Control
 * List, EU dual-use regulation annex, or a bank-provided file) before this
 * is relied on for anything but demoing the feature.
 */
@Component
public class HsCodeSanctionSeeder implements CommandLineRunner {

    private static final String PLACEHOLDER_SOURCE = "Illustrative placeholder - not a verified export-control source";
    private static final String SEEDED_DATE = "2026-09-17";

    private final SanctionedHsCodeRepository repository;

    public HsCodeSanctionSeeder(SanctionedHsCodeRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            return; // already seeded - don't overwrite a live-synced or manually-imported table
        }

        repository.saveAll(List.of(
            new SanctionedHsCode("8517.62", "IR", "Iran",
                "Telecommunications network/routing equipment",
                "Restricted under US sanctions program - surveillance/networking equipment export to Iran",
                SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED, PLACEHOLDER_SOURCE, SEEDED_DATE),
            new SanctionedHsCode("8411.91", "RU", "Russia",
                "Gas turbine parts (oil & gas exploration/refining equipment)",
                "Restricted under sectoral sanctions targeting Russia's energy sector",
                SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED, PLACEHOLDER_SOURCE, SEEDED_DATE),
            new SanctionedHsCode("8526.10", "RU", "Russia",
                "Radar apparatus",
                "Dual-use detection/radar equipment restricted for export to Russia",
                SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED, PLACEHOLDER_SOURCE, SEEDED_DATE),
            new SanctionedHsCode("2844.20", "KP", "North Korea",
                "Uranium, plutonium and compounds",
                "Nuclear-related materials restricted under UN Security Council sanctions",
                SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED, PLACEHOLDER_SOURCE, SEEDED_DATE),
            new SanctionedHsCode("8710.00", "KP", "North Korea",
                "Tanks and armoured fighting vehicles",
                "Military/defense articles restricted under UN arms embargo",
                SanctionedHsCode.RestrictionLevel.EXPORT_CONTROLLED, PLACEHOLDER_SOURCE, SEEDED_DATE),
            new SanctionedHsCode("9013.20", "IR", "Iran",
                "Lasers and laser apparatus",
                "Dual-use precision optics - requires export license review",
                SanctionedHsCode.RestrictionLevel.RESTRICTED, PLACEHOLDER_SOURCE, SEEDED_DATE)
        ));
    }
}
