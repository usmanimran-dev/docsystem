package com.edms.examination.repository;

import com.edms.examination.model.HsCodePricing;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface HsCodePricingRepository extends MongoRepository<HsCodePricing, String> {
    Optional<HsCodePricing> findByHsCode(String hsCode);
}
