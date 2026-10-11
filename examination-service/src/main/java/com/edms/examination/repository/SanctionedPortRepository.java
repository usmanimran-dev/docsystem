package com.edms.examination.repository;

import com.edms.examination.model.SanctionedPort;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SanctionedPortRepository extends MongoRepository<SanctionedPort, String> {
    Optional<SanctionedPort> findByUnlocode(String unlocode);
}
