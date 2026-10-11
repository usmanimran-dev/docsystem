package com.edms.examination.repository;

import com.edms.examination.model.SanctionedCountry;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SanctionedCountryRepository extends MongoRepository<SanctionedCountry, String> {
    Optional<SanctionedCountry> findByIsoCode(String isoCode);
}
