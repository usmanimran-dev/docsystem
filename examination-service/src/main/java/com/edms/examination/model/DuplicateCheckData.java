package com.edms.examination.model;

public class DuplicateCheckData {
    private boolean isDuplicate;
    private String hash;
    private String existingDocumentId;

    /**
     * "EXACT_FILE" or "SAME_CONTENT" - which of the two checks matched.
     * Persisted because the distinction survives a reload: telling someone
     * "this exact file was uploaded before" when it was actually a
     * re-scanned copy would be stating something untrue.
     */
    private String matchType;

    public DuplicateCheckData() {}

    public DuplicateCheckData(boolean isDuplicate, String hash, String existingDocumentId) {
        this.isDuplicate = isDuplicate;
        this.hash = hash;
        this.existingDocumentId = existingDocumentId;
    }

    public boolean isDuplicate() { return isDuplicate; }
    public void setDuplicate(boolean duplicate) { isDuplicate = duplicate; }

    public String getHash() { return hash; }
    public void setHash(String hash) { this.hash = hash; }

    public String getExistingDocumentId() { return existingDocumentId; }
    public void setExistingDocumentId(String existingDocumentId) { this.existingDocumentId = existingDocumentId; }

    public String getMatchType() { return matchType; }
    public void setMatchType(String matchType) { this.matchType = matchType; }
}
