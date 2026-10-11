package com.edms.examination.model;

public class AnomalyIssueData {
    private String id;
    private String type;       // document | data | financial | sanction
    private String severity;   // info | warning | critical
    private String field;
    private String message;
    private String value;
    private String suggestion;

    public AnomalyIssueData() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getField() { return field; }
    public void setField(String field) { this.field = field; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getSuggestion() { return suggestion; }
    public void setSuggestion(String suggestion) { this.suggestion = suggestion; }
}
