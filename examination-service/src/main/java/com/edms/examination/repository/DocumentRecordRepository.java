package com.edms.examination.repository;

import com.edms.examination.model.DocumentRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DocumentRecordRepository extends MongoRepository<DocumentRecord, String> {

    /** Newest first - the order a list of recent analyses is actually useful in. */
    Page<DocumentRecord> findAllByOrderByAnalysedAtDesc(Pageable pageable);

    /** Every prior analysis of the same file, newest first. */
    List<DocumentRecord> findByFileHashOrderByAnalysedAtDesc(String fileHash);

    /** Every prior analysis of the same DOCUMENT, newest first - see DocumentRecord.contentKey. */
    List<DocumentRecord> findByContentKeyOrderByAnalysedAtDesc(String contentKey);
}
