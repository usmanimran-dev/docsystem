package com.edms.examination.dto;

import java.time.Instant;

/**
 * Lightweight row for the list endpoint. A stored analysis carries the full
 * OCR text and every issue found - sending all of that for a list of fifty
 * documents would be wasteful, so listing returns only what a list actually
 * needs to display.
 */
public class AnalysisSummary {

    private String id;
    private String filename;
    private String fileType;
    private Instant analysedAt;
    private String documentType;
    private String overallStatus;
    private int totalIssues;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public Instant getAnalysedAt() { return analysedAt; }
    public void setAnalysedAt(Instant analysedAt) { this.analysedAt = analysedAt; }

    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }

    public String getOverallStatus() { return overallStatus; }
    public void setOverallStatus(String overallStatus) { this.overallStatus = overallStatus; }

    public int getTotalIssues() { return totalIssues; }
    public void setTotalIssues(int totalIssues) { this.totalIssues = totalIssues; }
}
