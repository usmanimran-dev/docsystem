package com.edms.examination.dto;

/** One row's outcome from a port-list import, for the response summary. */
public class PortImportRow {
    private final int lineNumber;
    private final String unlocode;
    private final String outcome; // ADDED | UPDATED | SKIPPED
    private final String reason;  // populated only when SKIPPED

    public PortImportRow(int lineNumber, String unlocode, String outcome, String reason) {
        this.lineNumber = lineNumber;
        this.unlocode = unlocode;
        this.outcome = outcome;
        this.reason = reason;
    }

    public int getLineNumber() { return lineNumber; }
    public String getUnlocode() { return unlocode; }
    public String getOutcome() { return outcome; }
    public String getReason() { return reason; }
}
