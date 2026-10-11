package com.edms.examination.dto;

import com.edms.examination.model.*;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * What the Document Reader posts once its pipeline finishes.
 *
 * Deliberately separate from {@link DocumentRecord}: the stored shape can
 * change (new indexes, renamed internals, extra server-side fields) without
 * breaking the contract the frontend was written against, and the client
 * cannot set server-owned fields like id or analysedAt by sending them.
 */
public class SaveAnalysisRequest {

    @NotBlank(message = "filename is required")
    private String filename;

    private String fileType;
    private String fileHash;

    /** Null when the extractor could not build a reliable one - see DocumentRecord.contentKey. */
    private String contentKey;

    private OcrResultData ocrResult;
    private FieldExtractionData fieldExtraction;
    private DuplicateCheckData duplicateCheck;
    private AnomalyReportData anomalyReport;
    private List<ManualExtractionData> manualExtractions;

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public String getFileHash() { return fileHash; }
    public void setFileHash(String fileHash) { this.fileHash = fileHash; }

    public String getContentKey() { return contentKey; }
    public void setContentKey(String contentKey) { this.contentKey = contentKey; }

    public OcrResultData getOcrResult() { return ocrResult; }
    public void setOcrResult(OcrResultData ocrResult) { this.ocrResult = ocrResult; }

    public FieldExtractionData getFieldExtraction() { return fieldExtraction; }
    public void setFieldExtraction(FieldExtractionData fieldExtraction) { this.fieldExtraction = fieldExtraction; }

    public DuplicateCheckData getDuplicateCheck() { return duplicateCheck; }
    public void setDuplicateCheck(DuplicateCheckData duplicateCheck) { this.duplicateCheck = duplicateCheck; }

    public AnomalyReportData getAnomalyReport() { return anomalyReport; }
    public void setAnomalyReport(AnomalyReportData anomalyReport) { this.anomalyReport = anomalyReport; }

    public List<ManualExtractionData> getManualExtractions() { return manualExtractions; }
    public void setManualExtractions(List<ManualExtractionData> manualExtractions) { this.manualExtractions = manualExtractions; }
}
