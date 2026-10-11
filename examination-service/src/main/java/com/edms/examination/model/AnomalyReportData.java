package com.edms.examination.model;

import java.util.List;

public class AnomalyReportData {
    private int totalIssues;
    private int criticalCount;
    private int warningCount;
    private int infoCount;
    private String overallStatus; // PASS | WARNING | FAILED
    private List<AnomalyIssueData> issues;

    public AnomalyReportData() {}

    public int getTotalIssues() { return totalIssues; }
    public void setTotalIssues(int totalIssues) { this.totalIssues = totalIssues; }

    public int getCriticalCount() { return criticalCount; }
    public void setCriticalCount(int criticalCount) { this.criticalCount = criticalCount; }

    public int getWarningCount() { return warningCount; }
    public void setWarningCount(int warningCount) { this.warningCount = warningCount; }

    public int getInfoCount() { return infoCount; }
    public void setInfoCount(int infoCount) { this.infoCount = infoCount; }

    public String getOverallStatus() { return overallStatus; }
    public void setOverallStatus(String overallStatus) { this.overallStatus = overallStatus; }

    public List<AnomalyIssueData> getIssues() { return issues; }
    public void setIssues(List<AnomalyIssueData> issues) { this.issues = issues; }
}
