package com.edms.examination.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Turns exceptions into honest HTTP responses. Without this, a missing record
 * returns a 500 with a stack trace - the exact failure mode already causing
 * trouble in the other backend, where an invalid token produces a 500 the
 * frontend interceptor cannot act on.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AnalysisNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(AnalysisNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
            .forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));

        Map<String, Object> body = baseBody(HttpStatus.BAD_REQUEST, "Request validation failed");
        body.put("fields", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * An external provider being down or rate-limited is not this service
     * failing - 502 says "the upstream did not answer", which is what a
     * caller needs to know to decide whether to retry or route to review.
     */
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, Object>> handleUpstream(RestClientException ex) {
        return build(HttpStatus.BAD_GATEWAY,
            "Upstream sanctions provider did not respond: " + ex.getMessage());
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(baseBody(status, message));
    }

    private Map<String, Object> baseBody(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }
}
