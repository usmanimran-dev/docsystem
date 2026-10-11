package com.edms.examination.repository;

import com.edms.examination.model.DiscrepancyReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DiscrepancyReportRepository extends MongoRepository<DiscrepancyReport, String> {

    Page<DiscrepancyReport> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Every prior report that touched this analysis, on either side. */
    List<DiscrepancyReport> findByDocumentAIdOrDocumentBIdOrderByCreatedAtDesc(
            String documentAId, String documentBId);

    /** Every report filed under one LC reference. */
    List<DiscrepancyReport> findByLcReferenceOrderByCreatedAtDesc(String lcReference);
}
