package com.edms.examination.config;

import com.edms.examination.model.HsCodePricing;
import com.edms.examination.repository.HsCodePricingRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Seeds a small set of illustrative HS code price ranges on first boot, so
 * the check works out of the box during development.
 *
 * PLACEHOLDER DATA - these ranges are rough, illustrative wholesale figures,
 * not sourced from a verified trade-pricing database. Imad's side owns real
 * pricing management per the 2026-09-07 meeting (their API will be the
 * eventual source) - replace or clear this table once that's wired up.
 * Same "don't overwrite a live/manually-imported table" guard as
 * SanctionsDataSeeder.
 */
@Component
public class HsCodePricingSeeder implements CommandLineRunner {

    private static final String PLACEHOLDER_SOURCE = "Illustrative placeholder - not a verified pricing source";
    private static final String SEEDED_DATE = "2026-09-07";

    private final HsCodePricingRepository repository;

    public HsCodePricingSeeder(HsCodePricingRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            return; // already seeded - don't overwrite a live-synced or manually-imported table
        }

        repository.saveAll(List.of(
            new HsCodePricing("6109.10", "T-Shirts, Cotton, Knitted or Crocheted",
                3.00, 8.00, "USD", PLACEHOLDER_SOURCE, SEEDED_DATE),
            new HsCodePricing("5201.00", "Cotton, Not Carded or Combed (raw, per kg)",
                1.20, 2.50, "USD", PLACEHOLDER_SOURCE, SEEDED_DATE),
            new HsCodePricing("6203.42", "Men's Trousers, Cotton",
                8.00, 20.00, "USD", PLACEHOLDER_SOURCE, SEEDED_DATE),
            new HsCodePricing("8517.12", "Mobile Phones",
                50.00, 500.00, "USD", PLACEHOLDER_SOURCE, SEEDED_DATE),
            new HsCodePricing("8471.30", "Portable Automatic Data Processing Machines (Laptops)",
                300.00, 2000.00, "USD", PLACEHOLDER_SOURCE, SEEDED_DATE)
        ));
    }
}
