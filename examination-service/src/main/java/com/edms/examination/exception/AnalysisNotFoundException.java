package com.edms.examination.exception;

public class AnalysisNotFoundException extends RuntimeException {
    public AnalysisNotFoundException(String id) {
        super("No stored analysis found with id: " + id);
    }
}
