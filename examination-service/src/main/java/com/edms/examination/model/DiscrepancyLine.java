package com.edms.examination.model;

/**
 * One line of a DiscrepancyReport: two documents' values for the same field
 * and how the comparison resolved.
 *
 * verdict:
 *   MATCH    - normalised values are equal
 *   CONFLICT - both sides have a value and they disagree
 *   REVIEW   - values differ but at least one side's extraction confidence
 *              is below the review threshold, so this is flagged for a
 *              human rather than reported as a hard conflict
 *
 * Fields where only one side had a value are skipped entirely - a missing
 * field on one document is not itself a discrepancy under UCP 600 14(d).
 */
public class DiscrepancyLine {

    private String fieldName;

    private String valueA;
    private String valueB;

    /**
     * The form actually compared, after per-field-kind normalisation
     * (company suffixes stripped, dates parsed, amounts as numbers, etc.).
     * Kept on the record so a later reviewer can see WHY MATCH was returned
     * for values that look different on the raw page.
     */
    private String normalizedA;
    private String normalizedB;

    private double confidenceA;
    private double confidenceB;

    private String verdict;

    /** Optional short reason, e.g. "differs by 1 digit" or "low OCR confidence". */
    private String note;

    public DiscrepancyLine() {}

    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }

    public String getValueA() { return valueA; }
    public void setValueA(String valueA) { this.valueA = valueA; }

    public String getValueB() { return valueB; }
    public void setValueB(String valueB) { this.valueB = valueB; }

    public String getNormalizedA() { return normalizedA; }
    public void setNormalizedA(String normalizedA) { this.normalizedA = normalizedA; }

    public String getNormalizedB() { return normalizedB; }
    public void setNormalizedB(String normalizedB) { this.normalizedB = normalizedB; }

    public double getConfidenceA() { return confidenceA; }
    public void setConfidenceA(double confidenceA) { this.confidenceA = confidenceA; }

    public double getConfidenceB() { return confidenceB; }
    public void setConfidenceB(double confidenceB) { this.confidenceB = confidenceB; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
