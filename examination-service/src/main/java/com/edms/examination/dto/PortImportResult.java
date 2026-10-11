package com.edms.examination.dto;

import java.time.Instant;
import java.util.List;

public class PortImportResult {
    private final String filename;
    private final Instant importedAt;
    private final int totalRows;
    private final int added;
    private final int updated;
    private final int skipped;
    private final List<PortImportRow> rows;

    public PortImportResult(String filename, Instant importedAt, int totalRows,
                             int added, int updated, int skipped, List<PortImportRow> rows) {
        this.filename = filename;
        this.importedAt = importedAt;
        this.totalRows = totalRows;
        this.added = added;
        this.updated = updated;
        this.skipped = skipped;
        this.rows = rows;
    }

    public String getFilename() { return filename; }
    public Instant getImportedAt() { return importedAt; }
    public int getTotalRows() { return totalRows; }
    public int getAdded() { return added; }
    public int getUpdated() { return updated; }
    public int getSkipped() { return skipped; }
    public List<PortImportRow> getRows() { return rows; }
}
