package com.edms.examination.dto;

import com.edms.examination.model.*;

import java.time.Instant;
import java.util.List;

/** Full stored analysis, returned when one record is fetched by id. */
public class AnalysisResponse {

    private String id;
    private String filename;
    private String fileType;
    private String fileHash;
    private String contentKey;
    private Instant analysedAt;

    private OcrResultData ocrResult;
    private FieldExtractionData fieldExtraction;
    private DuplicateCheckData duplicateCheck;
    private AnomalyReportData anomalyReport;
    private List<ManualExtractionData> manualExtractions;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }

    public String getFileHash() { return fileHash; }
    public void setFileHash(String fileHash) { this.fileHash = fileHash; }

    public String getContentKey() { return contentKey; }
    public void setContentKey(String contentKey) { this.contentKey = contentKey; }

    public Instant getAnalysedAt() { return analysedAt; }
    public void setAnalysedAt(Instant analysedAt) { this.analysedAt = analysedAt; }

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
