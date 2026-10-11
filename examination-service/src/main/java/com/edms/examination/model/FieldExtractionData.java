package com.edms.examination.model;

import java.util.List;

public class FieldExtractionData {
    private String documentType;
    private double overallConfidence;
    private List<ExtractedFieldData> fields;

    public FieldExtractionData() {}

    public FieldExtractionData(String documentType, double overallConfidence, List<ExtractedFieldData> fields) {
        this.documentType = documentType;
        this.overallConfidence = overallConfidence;
        this.fields = fields;
    }

    public String getDocumentType() { return documentType; }
    public void setDocumentType(String documentType) { this.documentType = documentType; }

    public double getOverallConfidence() { return overallConfidence; }
    public void setOverallConfidence(double overallConfidence) { this.overallConfidence = overallConfidence; }

    public List<ExtractedFieldData> getFields() { return fields; }
    public void setFields(List<ExtractedFieldData> fields) { this.fields = fields; }
}
