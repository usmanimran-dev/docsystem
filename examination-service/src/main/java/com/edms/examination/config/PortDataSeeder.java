package com.edms.examination.config;

import com.edms.examination.model.SanctionedPort;
import com.edms.examination.repository.SanctionedPortRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

import static com.edms.examination.model.SanctionedPort.Tier.HIGH_RISK;
import static com.edms.examination.model.SanctionedPort.Tier.SANCTIONED;

/**
 * Sample port data for testing (Imad, 2026-09-14). NOT an authoritative
 * sanctioned-ports registry - no such official list exists the way OFAC/FATF
 * publish for countries. Real ports inside countries already listed as
 * sanctioned, plus two known transshipment hubs. The bank's own list
 * replaces/extends this via CSV import.
 */
@Component
public class PortDataSeeder implements CommandLineRunner {

    private static final String SAMPLE_SOURCE = "Sample/test data - not an authoritative source, see PortDataSeeder";
    private static final String SEEDED_DATE = "2026-09-14";

    private final SanctionedPortRepository repository;
    private final MongoTemplate mongoTemplate;

    public PortDataSeeder(SanctionedPortRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void run(String... args) {
        // Rows imported before the SANCTIONED/HIGH_RISK split were stored as
        // BANK_HIGH_RISK, which no longer deserializes and 500s every port read.
        mongoTemplate.updateMulti(
            Query.query(Criteria.where("tier").is("BANK_HIGH_RISK")),
            Update.update("tier", HIGH_RISK.name()),
            "sanctioned_ports");

        List<SanctionedPort> samples = List.of(
            new SanctionedPort("IRBND", "Bandar Abbas", SANCTIONED, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("IRBIK", "Bandar Imam Khomeini", SANCTIONED, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("KPNAM", "Nampo", SANCTIONED, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("CUHAV", "Havana", SANCTIONED, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("RUNVS", "Novorossiysk", SANCTIONED, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("AEJEA", "Jebel Ali", HIGH_RISK, SAMPLE_SOURCE, SEEDED_DATE),
            new SanctionedPort("AEFJR", "Fujairah", HIGH_RISK, SAMPLE_SOURCE, SEEDED_DATE)
        );

        // Insert-if-absent, not seed-only-when-empty: a database that already
        // has the bank's demo port import would otherwise never get samples.
        // Existing entries are never overwritten.
        samples.stream()
            .filter(port -> repository.findByUnlocode(port.getUnlocode()).isEmpty())
            .forEach(repository::save);
    }
}
