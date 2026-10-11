package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * A completed Document Reader analysis, persisted so results survive a page
 * refresh and are visible to more than the one browser that produced them.
 *
 * Everything is embedded rather than referenced: OCR output, extracted fields
 * and the validation report are only ever read as part of their parent
 * analysis, never independently, so there is no reason to split them into
 * separate collections.
 *
 * fileHash is indexed (not unique) - the same file legitimately gets
 * re-analysed, e.g. after the extractor improves, and each run is kept as
 * its own record rather than overwriting the last.
 */
@Document(collection = "document_analyses")
public class DocumentRecord {

    @Id
    private String id;

    private String filename;
    private String fileType;          // "image" | "pdf"

    /**
     * GridFS id of the uploaded file itself, when one was stored. Null for
     * analyses saved before file storage existed, and for any saved without
     * the file - the analysis is the record, the file is an optional
     * attachment to it, so nothing here should assume it is present.
     */
    private String fileId;

    @Indexed
    private String fileHash;

    /**
     * Fingerprint of the document's own identifying CONTENT (its reference
     * number plus corroborating fields), as opposed to fileHash which
     * fingerprints the bytes. Catches the same document re-scanned or
     * re-exported, where every byte differs but it is still the same
     * invoice/BOL/statement.
     *
     * Null whenever the extractor could not find a reference number plus at
     * least one corroborating field - see the frontend's content-key
     * builder. A weak key is deliberately not stored at all rather than
     * stored and matched loosely.
     */
    @Indexed
    private String contentKey;

    @Indexed
    private Instant analysedAt;

    private OcrResultData ocrResult;
    private FieldExtractionData fieldExtraction;
    private DuplicateCheckData duplicateCheck;
    private AnomalyReportData anomalyReport;
    private List<ManualExtractionData> manualExtractions;

    public DocumentRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }

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
