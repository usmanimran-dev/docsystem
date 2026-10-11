package com.edms.examination.dto;

import com.edms.examination.model.DiscrepancyLine;

import java.time.Instant;
import java.util.List;

/**
 * Client-facing shape of a saved DiscrepancyReport. Adds the two documents'
 * filenames so the UI can label the columns without a second lookup.
 */
public class DiscrepancyReportResponse {

    private String id;
    private String documentAId;
    private String documentAFilename;
    private String documentBId;
    private String documentBFilename;
    private String lcReference;
    private String checkedBy;
    private Instant createdAt;

    private int totalCompared;
    private int matchCount;
    private int conflictCount;
    private int reviewCount;
    private String verdict;

    private List<DiscrepancyLine> results;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getDocumentAId() { return documentAId; }
    public void setDocumentAId(String documentAId) { this.documentAId = documentAId; }

    public String getDocumentAFilename() { return documentAFilename; }
    public void setDocumentAFilename(String documentAFilename) { this.documentAFilename = documentAFilename; }

    public String getDocumentBId() { return documentBId; }
    public void setDocumentBId(String documentBId) { this.documentBId = documentBId; }

    public String getDocumentBFilename() { return documentBFilename; }
    public void setDocumentBFilename(String documentBFilename) { this.documentBFilename = documentBFilename; }

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
