package com.edms.examination.mapper;

import com.edms.examination.dto.AnalysisResponse;
import com.edms.examination.dto.AnalysisSummary;
import com.edms.examination.dto.SaveAnalysisRequest;
import com.edms.examination.model.DocumentRecord;
import org.springframework.stereotype.Component;

/**
 * DTO <-> entity conversion, kept in one place so neither the controller nor
 * the service has to know the shape of the other side.
 */
@Component
public class AnalysisMapper {

    /** Server-owned fields (id, analysedAt) are deliberately not taken from the request. */
    public DocumentRecord toEntity(SaveAnalysisRequest request) {
        DocumentRecord record = new DocumentRecord();
        record.setFilename(request.getFilename());
        record.setFileType(request.getFileType());
        record.setFileHash(request.getFileHash());
        record.setContentKey(request.getContentKey());
        record.setOcrResult(request.getOcrResult());
        record.setFieldExtraction(request.getFieldExtraction());
        record.setDuplicateCheck(request.getDuplicateCheck());
        record.setAnomalyReport(request.getAnomalyReport());
        record.setManualExtractions(request.getManualExtractions());
        return record;
    }

    public AnalysisResponse toResponse(DocumentRecord record) {
        AnalysisResponse response = new AnalysisResponse();
        response.setId(record.getId());
        response.setFilename(record.getFilename());
        response.setFileType(record.getFileType());
        response.setFileHash(record.getFileHash());
        response.setContentKey(record.getContentKey());
        response.setAnalysedAt(record.getAnalysedAt());
        response.setOcrResult(record.getOcrResult());
        response.setFieldExtraction(record.getFieldExtraction());
        response.setDuplicateCheck(record.getDuplicateCheck());
        response.setAnomalyReport(record.getAnomalyReport());
        response.setManualExtractions(record.getManualExtractions());
        return response;
    }

    public AnalysisSummary toSummary(DocumentRecord record) {
        AnalysisSummary summary = new AnalysisSummary();
        summary.setId(record.getId());
        summary.setFilename(record.getFilename());
        summary.setFileType(record.getFileType());
        summary.setAnalysedAt(record.getAnalysedAt());

        if (record.getFieldExtraction() != null) {
            summary.setDocumentType(record.getFieldExtraction().getDocumentType());
        }
        if (record.getAnomalyReport() != null) {
            summary.setOverallStatus(record.getAnomalyReport().getOverallStatus());
            summary.setTotalIssues(record.getAnomalyReport().getTotalIssues());
        }
        return summary;
    }
}
