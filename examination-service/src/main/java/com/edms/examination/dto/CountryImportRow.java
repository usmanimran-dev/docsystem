package com.edms.examination.dto;

/** One row's outcome from a country-list import, for the response summary. */
public class CountryImportRow {
    private final int lineNumber;
    private final String isoCode;
    private final String outcome; // ADDED | UPDATED | SKIPPED
    private final String reason;  // populated only when SKIPPED

    public CountryImportRow(int lineNumber, String isoCode, String outcome, String reason) {
        this.lineNumber = lineNumber;
        this.isoCode = isoCode;
        this.outcome = outcome;
        this.reason = reason;
    }

    public int getLineNumber() { return lineNumber; }
    public String getIsoCode() { return isoCode; }
    public String getOutcome() { return outcome; }
    public String getReason() { return reason; }
}
