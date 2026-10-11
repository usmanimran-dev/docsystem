package com.edms.examination.repository;

import com.edms.examination.model.SanctionedHsCode;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SanctionedHsCodeRepository extends MongoRepository<SanctionedHsCode, String> {
    Optional<SanctionedHsCode> findByHsCodeAndCountryIsoCode(String hsCode, String countryIsoCode);
}
