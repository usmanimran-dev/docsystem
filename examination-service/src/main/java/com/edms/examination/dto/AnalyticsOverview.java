package com.edms.examination.dto;

import java.time.Instant;
import java.util.List;

/**
 * Everything the admin monitoring dashboard shows, in one response.
 *
 * One endpoint rather than eight: the page renders all of it at once, and the
 * collection is small enough that splitting it would cost more round trips
 * than it saved work. Read-only throughout - nothing here changes any record.
 */
public record AnalyticsOverview(
    Instant generatedAt,
    /** Days of history included. 0 means everything ever recorded. */
    int windowDays,
    Totals totals,
    List<DayPoint> confidenceTrend,
    List<DocumentTypeCount> documentTypes,
    List<TypeFieldCoverage> fieldCoverage,
    Validation validation,
    Discrepancies discrepancies,
    Duplication duplication,
    List<NameCount> fileTypes
) {

    public record Totals(
        long analyses,
        long distinctDocuments,
        long discrepancyReports,
        long analysesWithCriticalIssues
    ) {}

    /**
     * One day of extraction quality. A sustained fall in
     * avgExtractionConfidence, or a field count that drops without the volume
     * changing, is what a broken extractor pattern looks like from here.
     */
    public record DayPoint(
        String day,
        long analyses,
        double avgExtractionConfidence,
        double avgReadConfidence,
        double avgFieldsExtracted
    ) {}

    public record DocumentTypeCount(
        String documentType,
        long count,
        double avgConfidence
    ) {}

    /**
     * How often each field is actually found, per document type. A field that
     * appears on a small fraction of a type it belongs to is a weak pattern,
     * which is why these are returned worst-first.
     */
    public record TypeFieldCoverage(
        String documentType,
        long totalDocuments,
        List<FieldCoverage> fields
    ) {}

    public record FieldCoverage(
        String fieldName,
        long present,
        double coverage
    ) {}

    public record Validation(
        List<NameCount> byStatus,
        List<IssueCount> topIssues
    ) {}

    /**
     * Keyed on type AND field: type alone has only four values
     * (document/data/financial/sanction), which says nothing about what to go
     * and fix. "sanction on country" and "data on hsCode" do.
     */
    public record IssueCount(
        String type,
        String field,
        String severity,
        long count
    ) {}

    public record Discrepancies(
        long reports,
        long clean,
        long withFindings,
        long totalConflicts,
        long totalReviews,
        List<NameCount> topConflictFields
    ) {}

    /**
     * fileHash fingerprints the bytes, contentKey the document's own identity -
     * so a re-scan of one invoice is a new hash but the same content key. The
     * gap between them is re-submission of the same document in a new file.
     */
    public record Duplication(
        long analyses,
        long distinctFileHashes,
        long distinctContentKeys,
        long repeatAnalyses
    ) {}

    public record NameCount(
        String name,
        long count
    ) {}
}
