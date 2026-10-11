package com.edms.examination.model;

public class OcrResultData {
    private String text;
    private double confidence;

    public OcrResultData() {}

    public OcrResultData(String text, double confidence) {
        this.text = text;
        this.confidence = confidence;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }
}
