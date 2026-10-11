package com.edms.examination.service;

import com.edms.examination.dto.AnalyticsOverview;
import com.edms.examination.dto.AnalyticsOverview.*;
import com.edms.examination.model.AnomalyIssueData;
import com.edms.examination.model.DiscrepancyLine;
import com.edms.examination.model.DiscrepancyReport;
import com.edms.examination.model.DocumentRecord;
import com.edms.examination.model.ExtractedFieldData;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Stats for the admin monitoring dashboard. Read-only. */
@Service
public class AnalyticsService {

    private static final DateTimeFormatter DAY_FORMAT =
        DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC);

    private static final String UNKNOWN = "UNKNOWN";
    private static final int TOP_N = 10;

    private final MongoTemplate mongo;

    public AnalyticsService(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public AnalyticsOverview overview(int windowDays) {
        Instant from = windowDays > 0 ? Instant.now().minus(Duration.ofDays(windowDays)) : null;
        List<DocumentRecord> analyses = findAnalyses(from);
        List<DiscrepancyReport> reports = findReports(from);

        return new AnalyticsOverview(
            Instant.now(),
            windowDays,
            countTotals(analyses, reports),
            buildDailyTrend(analyses),
            countDocumentTypes(analyses),
            measureFieldCoverage(analyses),
            summariseValidation(analyses),
            summariseDiscrepancies(reports),
            countDuplication(analyses),
            countFileTypes(analyses));
    }

    // Projected: ocrResult.text holds the whole document, tens of kB a record,
    // and nothing here reads it.
    private List<DocumentRecord> findAnalyses(Instant from) {
        Query query = from == null ? new Query() : new Query(Criteria.where("analysedAt").gte(from));
        query.fields()
            .include("analysedAt")
            .include("fileType")
            .include("fileHash")
            .include("contentKey")
            .include("ocrResult.confidence")
            .include("fieldExtraction.documentType")
            .include("fieldExtraction.overallConfidence")
            .include("fieldExtraction.fields.fieldName")
            .include("anomalyReport.overallStatus")
            .include("anomalyReport.criticalCount")
            .include("anomalyReport.issues.type")
            .include("anomalyReport.issues.field")
            .include("anomalyReport.issues.severity");
        return mongo.find(query, DocumentRecord.class);
    }

    private List<DiscrepancyReport> findReports(Instant from) {
        Query query = from == null ? new Query() : new Query(Criteria.where("createdAt").gte(from));
        return mongo.find(query, DiscrepancyReport.class);
    }

    private Totals countTotals(List<DocumentRecord> analyses, List<DiscrepancyReport> reports) {
        Set<String> documents = new HashSet<>();
        long withCriticalIssues = 0;

        for (DocumentRecord analysis : analyses) {
            documents.add(documentIdentity(analysis));
            if (criticalCountOf(analysis) > 0) {
                withCriticalIssues++;
            }
        }
        return new Totals(analyses.size(), documents.size(), reports.size(), withCriticalIssues);
    }

    private List<DayPoint> buildDailyTrend(List<DocumentRecord> analyses) {
        Map<String, DailyTotals> byDay = new HashMap<>();

        for (DocumentRecord analysis : analyses) {
            if (analysis.getAnalysedAt() == null) {
                continue;
            }
            byDay.computeIfAbsent(DAY_FORMAT.format(analysis.getAnalysedAt()), day -> new DailyTotals())
                 .add(analysis);
        }

        List<DayPoint> trend = new ArrayList<>();
        byDay.forEach((day, totals) -> trend.add(totals.toDayPoint(day)));
        trend.sort(Comparator.comparing(DayPoint::day));
        return trend;
    }

    private List<DocumentTypeCount> countDocumentTypes(List<DocumentRecord> analyses) {
        Map<String, TypeTotals> byType = new LinkedHashMap<>();
        for (DocumentRecord analysis : analyses) {
            byType.computeIfAbsent(documentTypeOf(analysis), type -> new TypeTotals()).add(analysis);
        }

        List<DocumentTypeCount> counts = new ArrayList<>();
        byType.forEach((type, totals) -> counts.add(totals.toCount(type)));
        counts.sort(Comparator.comparingLong(DocumentTypeCount::count).reversed());
        return counts;
    }

    private List<TypeFieldCoverage> measureFieldCoverage(List<DocumentRecord> analyses) {
        Map<String, Long> documentsPerType = new HashMap<>();
        Map<String, Map<String, Long>> fieldHitsPerType = new HashMap<>();

        for (DocumentRecord analysis : analyses) {
            String type = documentTypeOf(analysis);
            documentsPerType.merge(type, 1L, Long::sum);
            Map<String, Long> fieldHits = fieldHitsPerType.computeIfAbsent(type, key -> new HashMap<>());
            for (String fieldName : fieldNamesOf(analysis)) {
                fieldHits.merge(fieldName, 1L, Long::sum);
            }
        }

        List<TypeFieldCoverage> coverage = new ArrayList<>();
        fieldHitsPerType.forEach((type, fieldHits) ->
            coverage.add(buildCoverage(type, documentsPerType.getOrDefault(type, 0L), fieldHits)));
        coverage.sort(Comparator.comparingLong(TypeFieldCoverage::totalDocuments).reversed());
        return coverage;
    }

    private TypeFieldCoverage buildCoverage(String type, long totalDocuments, Map<String, Long> fieldHits) {
        List<FieldCoverage> fields = new ArrayList<>();
        fieldHits.forEach((fieldName, hits) ->
            fields.add(new FieldCoverage(fieldName, hits, totalDocuments == 0 ? 0 : round((double) hits / totalDocuments))));

        // Worst first — this list is read to pick the next pattern to fix.
        fields.sort(Comparator.comparingDouble(FieldCoverage::coverage));
        return new TypeFieldCoverage(type, totalDocuments, fields);
    }

    private Validation summariseValidation(List<DocumentRecord> analyses) {
        Map<String, Long> statusCounts = new HashMap<>();
        Map<IssueKey, Long> issueCounts = new HashMap<>();
        Map<IssueKey, String> severities = new HashMap<>();

        for (DocumentRecord analysis : analyses) {
            if (analysis.getAnomalyReport() == null) {
                statusCounts.merge("NOT CHECKED", 1L, Long::sum);
                continue;
            }
            statusCounts.merge(orDefault(analysis.getAnomalyReport().getOverallStatus(), UNKNOWN), 1L, Long::sum);
            countIssues(analysis, issueCounts, severities);
        }

        List<IssueCount> topIssues = new ArrayList<>();
        issueCounts.forEach((key, count) ->
            topIssues.add(new IssueCount(key.type(), key.field(), severities.getOrDefault(key, "-"), count)));
        topIssues.sort(Comparator.comparingLong(IssueCount::count).reversed());

        return new Validation(toNameCounts(statusCounts), take(topIssues, TOP_N));
    }

    private void countIssues(DocumentRecord analysis,
                             Map<IssueKey, Long> issueCounts,
                             Map<IssueKey, String> severities) {
        List<AnomalyIssueData> issues = analysis.getAnomalyReport().getIssues();
        if (issues == null) {
            return;
        }
        for (AnomalyIssueData issue : issues) {
            IssueKey key = new IssueKey(orDefault(issue.getType(), UNKNOWN), orDefault(issue.getField(), "-"));
            issueCounts.merge(key, 1L, Long::sum);
            severities.putIfAbsent(key, orDefault(issue.getSeverity(), "-"));
        }
    }

    private Discrepancies summariseDiscrepancies(List<DiscrepancyReport> reports) {
        long cleanReports = 0;
        long conflicts = 0;
        long reviews = 0;
        Map<String, Long> conflictsPerField = new HashMap<>();

        for (DiscrepancyReport report : reports) {
            if ("CLEAN".equals(report.getVerdict())) {
                cleanReports++;
            }
            conflicts += report.getConflictCount();
            reviews += report.getReviewCount();
            countConflictFields(report, conflictsPerField);
        }

        return new Discrepancies(
            reports.size(),
            cleanReports,
            reports.size() - cleanReports,
            conflicts,
            reviews,
            take(toNameCounts(conflictsPerField), TOP_N));
    }

    private void countConflictFields(DiscrepancyReport report, Map<String, Long> conflictsPerField) {
        if (report.getResults() == null) {
            return;
        }
        for (DiscrepancyLine line : report.getResults()) {
            if ("CONFLICT".equals(line.getVerdict())) {
                conflictsPerField.merge(line.getFieldName(), 1L, Long::sum);
            }
        }
    }

    // fileHash fingerprints the bytes, contentKey the document itself — so a
    // re-scan of one invoice is a new hash but the same content key.
    private Duplication countDuplication(List<DocumentRecord> analyses) {
        Set<String> fileHashes = new HashSet<>();
        Set<String> contentKeys = new HashSet<>();

        for (DocumentRecord analysis : analyses) {
            if (isNotBlank(analysis.getFileHash())) {
                fileHashes.add(analysis.getFileHash());
            }
            if (isNotBlank(analysis.getContentKey())) {
                contentKeys.add(analysis.getContentKey());
            }
        }

        long repeats = Math.max(0, analyses.size() - fileHashes.size());
        return new Duplication(analyses.size(), fileHashes.size(), contentKeys.size(), repeats);
    }

    private List<NameCount> countFileTypes(List<DocumentRecord> analyses) {
        Map<String, Long> counts = new HashMap<>();
        for (DocumentRecord analysis : analyses) {
            counts.merge(orDefault(analysis.getFileType(), "unknown"), 1L, Long::sum);
        }
        return toNameCounts(counts);
    }

    // ---- small helpers ----

    private String documentIdentity(DocumentRecord analysis) {
        if (isNotBlank(analysis.getContentKey())) {
            return analysis.getContentKey();
        }
        if (isNotBlank(analysis.getFileHash())) {
            return analysis.getFileHash();
        }
        return analysis.getId();
    }

    private String documentTypeOf(DocumentRecord analysis) {
        return analysis.getFieldExtraction() == null
            ? UNKNOWN
            : orDefault(analysis.getFieldExtraction().getDocumentType(), UNKNOWN);
    }

    /** A set, so a field extracted twice on one document still counts once. */
    private Set<String> fieldNamesOf(DocumentRecord analysis) {
        Set<String> names = new HashSet<>();
        if (analysis.getFieldExtraction() == null || analysis.getFieldExtraction().getFields() == null) {
            return names;
        }
        for (ExtractedFieldData field : analysis.getFieldExtraction().getFields()) {
            names.add(field.getFieldName());
        }
        return names;
    }

    private int criticalCountOf(DocumentRecord analysis) {
        return analysis.getAnomalyReport() == null ? 0 : analysis.getAnomalyReport().getCriticalCount();
    }

    private List<NameCount> toNameCounts(Map<String, Long> counts) {
        List<NameCount> result = new ArrayList<>();
        counts.forEach((name, count) -> result.add(new NameCount(name, count)));
        result.sort(Comparator.comparingLong(NameCount::count).reversed());
        return result;
    }

    private static <T> List<T> take(List<T> items, int limit) {
        return items.subList(0, Math.min(limit, items.size()));
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String orDefault(String value, String fallback) {
        return isNotBlank(value) ? value : fallback;
    }

    // ocrResult.confidence is stored on two scales: most records use 0-1, but
    // documents read from a PDF text layer were written as a percentage. Mixing
    // them put a day's average read confidence at 69 on a 0-1 chart. The real
    // fix belongs where the value is written.
    private static double toZeroToOne(double storedConfidence) {
        return storedConfidence > 1 ? storedConfidence / 100 : storedConfidence;
    }

    private static double round(double value) {
        return Double.isNaN(value) || Double.isInfinite(value) ? 0 : Math.round(value * 1000d) / 1000d;
    }

    private record IssueKey(String type, String field) {}

    /** Running totals for one day of the trend chart. */
    private static final class DailyTotals {
        private long analyses;
        private double extractionConfidence;
        private double readConfidence;
        private long fieldsExtracted;

        void add(DocumentRecord analysis) {
            analyses++;
            if (analysis.getFieldExtraction() != null) {
                extractionConfidence += analysis.getFieldExtraction().getOverallConfidence();
                List<ExtractedFieldData> fields = analysis.getFieldExtraction().getFields();
                fieldsExtracted += fields == null ? 0 : fields.size();
            }
            if (analysis.getOcrResult() != null) {
                readConfidence += toZeroToOne(analysis.getOcrResult().getConfidence());
            }
        }

        DayPoint toDayPoint(String day) {
            return new DayPoint(
                day,
                analyses,
                round(extractionConfidence / analyses),
                round(readConfidence / analyses),
                round((double) fieldsExtracted / analyses));
        }
    }

    /** Running totals for one document type. */
    private static final class TypeTotals {
        private long count;
        private double confidence;

        void add(DocumentRecord analysis) {
            count++;
            if (analysis.getFieldExtraction() != null) {
                confidence += analysis.getFieldExtraction().getOverallConfidence();
            }
        }

        DocumentTypeCount toCount(String documentType) {
            return new DocumentTypeCount(documentType, count, round(confidence / count));
        }
    }
}
