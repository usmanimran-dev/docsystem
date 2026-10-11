package com.edms.examination.config;

import com.edms.examination.model.SanctionedCountry;
import com.edms.examination.repository.SanctionedCountryRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.edms.examination.model.SanctionedCountry.ListType.FATF_AML_RISK;
import static com.edms.examination.model.SanctionedCountry.ListType.OFAC_SANCTIONS;
import static com.edms.examination.model.SanctionedCountry.Tier.*;

/**
 * Seeds the country-risk table on first boot, so the service works without
 * needing a live sync just to be usable.
 *
 * Two separate, deliberately NOT conflated regimes live in this table -
 * see SanctionedCountry.ListType for why merging them would be wrong, not
 * just imprecise:
 *
 *   OFAC_SANCTIONS - fetched from ofac.treasury.gov on 26 Aug 2026,
 *   per-program page, not from memory.
 *
 *   FATF_AML_RISK - fetched from en.wikipedia.org/wiki/FATF_blacklist on
 *   4 Sep 2026, citing FATF's own list as of 13 Feb 2026 (the most recent
 *   plenary update at fetch time). FATF's own site returned HTTP 403 to
 *   automated fetches, hence the secondary source - re-verify against
 *   fatf-gafi.org directly when doing a manual refresh.
 *
 * Syria deliberately has no OFAC_SANCTIONS entry: OFAC lifted comprehensive
 * Syria sanctions (six founding executive orders revoked 1 Jul 2025; State
 * Sponsor of Terrorism designation rescinded 24 Aug 2026). It DOES have a
 * FATF_AML_RISK entry (grey list) - both facts are independently true and
 * both are represented, correctly, as different things.
 *
 * Re-verify periodically:
 *   ofac.treasury.gov/sanctions-programs-and-country-information
 *   fatf-gafi.org/en/publications/High-riskandothermonitoredjurisdictions.html
 */
@Component
public class SanctionsDataSeeder implements CommandLineRunner {

    private static final String OFAC_SOURCE = "https://ofac.treasury.gov/sanctions-programs-and-country-information";
    private static final String OFAC_VERIFIED = "2026-08-26";

    private static final String FATF_SOURCE = "https://www.fatf-gafi.org/en/publications/High-riskandothermonitoredjurisdictions.html";
    private static final String FATF_VERIFIED = "2026-09-04"; // fetch date; FATF's own list dated 2026-02-13

    private final SanctionedCountryRepository repository;

    public SanctionsDataSeeder(SanctionedCountryRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            return; // already seeded - don't overwrite a live-synced or manually-imported table
        }

        repository.saveAll(List.of(
            // --- OFAC sanctions programs ---
            new SanctionedCountry("IR", "Iran",
                List.of("Iran", "Islamic Republic of Iran"),
                COMPREHENSIVE, OFAC_SANCTIONS, OFAC_SOURCE + "/iran-sanctions", OFAC_VERIFIED),

            new SanctionedCountry("KP", "North Korea",
                List.of("North Korea", "DPRK", "Democratic People's Republic of Korea"),
                COMPREHENSIVE, OFAC_SANCTIONS, OFAC_SOURCE + "/north-korea-sanctions", OFAC_VERIFIED),

            new SanctionedCountry("CU", "Cuba",
                List.of("Cuba"),
                COMPREHENSIVE, OFAC_SANCTIONS, OFAC_SOURCE + "/cuba-sanctions", OFAC_VERIFIED),

            new SanctionedCountry("RU", "Russia",
                List.of("Russia", "Russian Federation"),
                SECTORAL, OFAC_SANCTIONS, OFAC_SOURCE + "/ukraine-russia-related-sanctions", OFAC_VERIFIED),

            new SanctionedCountry("BY", "Belarus",
                List.of("Belarus"),
                SECTORAL, OFAC_SANCTIONS, OFAC_SOURCE + "/belarus-sanctions", OFAC_VERIFIED),

            // --- FATF "black list" - High-Risk Jurisdictions subject to a Call for Action ---
            // Iran and North Korea are also on this list, but already have an OFAC
            // entry above (which is the more severe, more specific classification) -
            // not duplicated here to keep one record per country.
            new SanctionedCountry("MM", "Myanmar",
                List.of("Myanmar", "Burma"),
                FATF_BLACKLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),

            // --- FATF "grey list" - Jurisdictions under Increased Monitoring ---
            new SanctionedCountry("DZ", "Algeria", List.of("Algeria"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("AO", "Angola", List.of("Angola"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("BO", "Bolivia", List.of("Bolivia"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("BG", "Bulgaria", List.of("Bulgaria"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("CM", "Cameroon", List.of("Cameroon"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("CI", "Cote d'Ivoire", List.of("Cote d'Ivoire", "Ivory Coast", "Côte d'Ivoire"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("CD", "Democratic Republic of the Congo", List.of("Democratic Republic of the Congo", "DRC", "DR Congo"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("HT", "Haiti", List.of("Haiti"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("KE", "Kenya", List.of("Kenya"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("KW", "Kuwait", List.of("Kuwait"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("LA", "Laos", List.of("Laos", "Lao PDR"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("LB", "Lebanon", List.of("Lebanon"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("MC", "Monaco", List.of("Monaco"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("NA", "Namibia", List.of("Namibia"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("NP", "Nepal", List.of("Nepal"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("PG", "Papua New Guinea", List.of("Papua New Guinea", "PNG"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("SN", "Senegal", List.of("Senegal"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("SS", "South Sudan", List.of("South Sudan"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            // Syria: no OFAC entry (see class-level note) - this FATF entry is the
            // only country-level flag for Syria in this table, and it correctly
            // says "AML monitoring", not "sanctioned".
            new SanctionedCountry("SY", "Syria", List.of("Syria", "Syrian Arab Republic"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("VE", "Venezuela", List.of("Venezuela"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("VN", "Vietnam", List.of("Vietnam", "Viet Nam"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("VG", "British Virgin Islands", List.of("British Virgin Islands", "BVI"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED),
            new SanctionedCountry("YE", "Yemen", List.of("Yemen"), FATF_GREYLIST, FATF_AML_RISK, FATF_SOURCE, FATF_VERIFIED)
        ));
    }
}
