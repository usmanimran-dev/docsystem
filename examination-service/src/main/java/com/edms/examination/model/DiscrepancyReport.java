package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Result of comparing two analysed documents field by field.
 *
 * Points at two DocumentRecord ids rather than duplicating their extracted
 * fields - the analyses are the source of truth, the report is a derived
 * view. Re-running the check against the same pair creates a new report;
 * old ones are kept so an audit trail of what was compared, when, and by
 * whom is preserved.
 */
@Document(collection = "discrepancy_reports")
public class DiscrepancyReport {

    @Id
    private String id;

    @Indexed
    private String documentAId;

    @Indexed
    private String documentBId;

    /** Optional - the LC reference this pair belongs to, when known. */
    private String lcReference;

    /** Login id of the user who ran the check. */
    private String checkedBy;

    private Instant createdAt;

    private int totalCompared;
    private int matchCount;
    private int conflictCount;
    private int reviewCount;

    /** MATCH when every compared line matched, otherwise DISCREPANCIES_FOUND. */
    private String verdict;

    private List<DiscrepancyLine> results;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDocumentAId() { return documentAId; }
    public void setDocumentAId(String documentAId) { this.documentAId = documentAId; }

    public String getDocumentBId() { return documentBId; }
    public void setDocumentBId(String documentBId) { this.documentBId = documentBId; }

    public String getLcReference() { return lcReference; }
    public void setLcReference(String lcReference) { this.lcReference = lcReference; }

    public String getCheckedBy() { return checkedBy; }
    public void setCheckedBy(String checkedBy) { this.checkedBy = checkedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public int getTotalCompared() { return totalCompared; }
    public void setTotalCompared(int totalCompared) { this.totalCompared = totalCompared; }

    public int getMatchCount() { return matchCount; }
    public void setMatchCount(int matchCount) { this.matchCount = matchCount; }

    public int getConflictCount() { return conflictCount; }
    public void setConflictCount(int conflictCount) { this.conflictCount = conflictCount; }

    public int getReviewCount() { return reviewCount; }
    public void setReviewCount(int reviewCount) { this.reviewCount = reviewCount; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public List<DiscrepancyLine> getResults() { return results; }
    public void setResults(List<DiscrepancyLine> results) { this.results = results; }
}
