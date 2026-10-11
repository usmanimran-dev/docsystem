package com.edms.examination.model;

/** One extracted field (account number, date, amount, etc.) with its confidence. */
public class ExtractedFieldData {
    private String fieldName;
    private String value;
    private double confidence;

    public ExtractedFieldData() {}

    public ExtractedFieldData(String fieldName, String value, double confidence) {
        this.fieldName = fieldName;
        this.value = value;
        this.confidence = confidence;
    }

    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }
}
