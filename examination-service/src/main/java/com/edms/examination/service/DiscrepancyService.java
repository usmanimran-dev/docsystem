package com.edms.examination.service;

import com.edms.examination.dto.DiscrepancyCheckRequest;
import com.edms.examination.dto.DiscrepancyReportResponse;
import com.edms.examination.model.DiscrepancyLine;
import com.edms.examination.model.DiscrepancyReport;
import com.edms.examination.model.DocumentRecord;
import com.edms.examination.model.ExtractedFieldData;
import com.edms.examination.repository.DiscrepancyReportRepository;
import com.edms.examination.repository.DocumentRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Compares two saved analyses field by field and records what disagrees.
 *
 * No field mapping table is needed: the extractor runs the same pattern set
 * over every document regardless of type, so both analyses come back in one
 * shared field namespace and portOfLoading means the same thing on an
 * invoice as on a bill of lading.
 *
 * Fields present on only one document are skipped rather than flagged. A
 * bill of lading legitimately has no HS code; absence is not conflict.
 */
@Service
public class DiscrepancyService {

    static final String MATCH = "MATCH";
    static final String CONFLICT = "CONFLICT";
    static final String REVIEW = "REVIEW";

    /**
     * Below this, a differing value is reported as REVIEW rather than
     * CONFLICT - at low confidence the extractor is as likely to be wrong as
     * the document is. Matches the 0.7 default the extractor assigns to
     * fields with no specific confidence rule.
     */
    private static final double REVIEW_CONFIDENCE_THRESHOLD = 0.7;

    private final DocumentRecordRepository documents;
    private final DiscrepancyReportRepository reports;
    private final FieldNormalizer normalizer;

    public DiscrepancyService(DocumentRecordRepository documents,
                              DiscrepancyReportRepository reports,
                              FieldNormalizer normalizer) {
        this.documents = documents;
        this.reports = reports;
        this.normalizer = normalizer;
    }

    public DiscrepancyReportResponse check(DiscrepancyCheckRequest request) {
        if (request.getDocumentAId().equals(request.getDocumentBId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cannot compare a document with itself");
        }

        DocumentRecord a = load(request.getDocumentAId());
        DocumentRecord b = load(request.getDocumentBId());

        List<DiscrepancyLine> lines = compare(fieldsOf(a), fieldsOf(b));

        DiscrepancyReport report = new DiscrepancyReport();
        report.setDocumentAId(a.getId());
        report.setDocumentBId(b.getId());
        report.setLcReference(request.getLcReference());
        report.setCheckedBy(request.getCheckedBy());
        report.setCreatedAt(Instant.now());
        report.setResults(lines);
        report.setTotalCompared(lines.size());
        report.setMatchCount((int) lines.stream().filter(l -> MATCH.equals(l.getVerdict())).count());
        report.setConflictCount((int) lines.stream().filter(l -> CONFLICT.equals(l.getVerdict())).count());
        report.setReviewCount((int) lines.stream().filter(l -> REVIEW.equals(l.getVerdict())).count());
        report.setVerdict(report.getConflictCount() > 0 || report.getReviewCount() > 0
            ? "DISCREPANCIES_FOUND" : "CLEAN");

        return toResponse(reports.save(report), a, b);
    }

    public DiscrepancyReportResponse getById(String id) {
        DiscrepancyReport report = reports.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Discrepancy report not found: " + id));

        return toResponse(report,
            documents.findById(report.getDocumentAId()).orElse(null),
            documents.findById(report.getDocumentBId()).orElse(null));
    }

    public List<DiscrepancyReport> findByLcReference(String lcReference) {
        return reports.findByLcReferenceOrderByCreatedAtDesc(lcReference);
    }

    private DocumentRecord load(String id) {
        return documents.findById(id).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis not found: " + id));
    }

    /** Last value wins if the extractor somehow produced a field twice. */
    private Map<String, ExtractedFieldData> fieldsOf(DocumentRecord record) {
        Map<String, ExtractedFieldData> byName = new LinkedHashMap<>();
        if (record.getFieldExtraction() == null || record.getFieldExtraction().getFields() == null) {
            return byName;
        }
        for (ExtractedFieldData field : record.getFieldExtraction().getFields()) {
            byName.put(field.getFieldName(), field);
        }
        return byName;
    }

    List<DiscrepancyLine> compare(Map<String, ExtractedFieldData> a,
                                  Map<String, ExtractedFieldData> b) {
        List<DiscrepancyLine> lines = new ArrayList<>();

        for (Map.Entry<String, ExtractedFieldData> entry : a.entrySet()) {
            ExtractedFieldData fieldB = b.get(entry.getKey());
            if (fieldB == null) {
                continue;
            }
            lines.add(compareOne(entry.getKey(), entry.getValue(), fieldB));
        }
        return lines;
    }

    private DiscrepancyLine compareOne(String fieldName,
                                       ExtractedFieldData a,
                                       ExtractedFieldData b) {
        DiscrepancyLine line = new DiscrepancyLine();
        line.setFieldName(fieldName);
        line.setValueA(a.getValue());
        line.setValueB(b.getValue());
        line.setConfidenceA(a.getConfidence());
        line.setConfidenceB(b.getConfidence());

        String normA = normalizer.normalize(fieldName, a.getValue());
        String normB = normalizer.normalize(fieldName, b.getValue());
        line.setNormalizedA(normA);
        line.setNormalizedB(normB);

        if (normA == null || normB == null) {
            line.setVerdict(REVIEW);
            line.setNote("Value could not be read in this field's expected format");
            return line;
        }

        if (normA.equals(normB)) {
            line.setVerdict(MATCH);
            return line;
        }

        if (a.getConfidence() < REVIEW_CONFIDENCE_THRESHOLD
            || b.getConfidence() < REVIEW_CONFIDENCE_THRESHOLD) {
            line.setVerdict(REVIEW);
            line.setNote("Values differ but extraction confidence is low");
            return line;
        }

        if (normalizer.differsByOneCharacter(normA, normB)) {
            line.setVerdict(REVIEW);
            line.setNote("Differs by one character - possible reading error");
            return line;
        }

        if (normalizer.kindOf(fieldName) == FieldNormalizer.Kind.PORT
            && isCodeVersusName(normA, normB)) {
            line.setVerdict(REVIEW);
            line.setNote("One document uses a port code and the other a port name");
            return line;
        }

        line.setVerdict(CONFLICT);
        return line;
    }

    /** A UN/LOCODE is five letters; a port name is longer and usually spaced. */
    private boolean isCodeVersusName(String a, String b) {
        boolean aIsCode = a.matches("[A-Z]{3,5}");
        boolean bIsCode = b.matches("[A-Z]{3,5}");
        return aIsCode != bIsCode;
    }

    private DiscrepancyReportResponse toResponse(DiscrepancyReport report,
                                                 DocumentRecord a,
                                                 DocumentRecord b) {
        DiscrepancyReportResponse response = new DiscrepancyReportResponse();
        response.setId(report.getId());
        response.setDocumentAId(report.getDocumentAId());
        response.setDocumentBId(report.getDocumentBId());
        response.setDocumentAFilename(a != null ? a.getFilename() : null);
        response.setDocumentBFilename(b != null ? b.getFilename() : null);
        response.setLcReference(report.getLcReference());
        response.setCheckedBy(report.getCheckedBy());
        response.setCreatedAt(report.getCreatedAt());
        response.setTotalCompared(report.getTotalCompared());
        response.setMatchCount(report.getMatchCount());
        response.setConflictCount(report.getConflictCount());
        response.setReviewCount(report.getReviewCount());
        response.setVerdict(report.getVerdict());
        response.setResults(report.getResults());
        return response;
    }
}
