package com.edms.examination.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Two document ids to compare, plus optional context. The service loads the
 * saved analyses by id - no field data is sent from the client, so the check
 * can't be fooled with fabricated values.
 */
public class DiscrepancyCheckRequest {

    @NotBlank
    private String documentAId;

    @NotBlank
    private String documentBId;

    private String lcReference;
    private String checkedBy;

    public String getDocumentAId() { return documentAId; }
    public void setDocumentAId(String documentAId) { this.documentAId = documentAId; }

    public String getDocumentBId() { return documentBId; }
    public void setDocumentBId(String documentBId) { this.documentBId = documentBId; }

    public String getLcReference() { return lcReference; }
    public void setLcReference(String lcReference) { this.lcReference = lcReference; }

    public String getCheckedBy() { return checkedBy; }
    public void setCheckedBy(String checkedBy) { this.checkedBy = checkedBy; }
}
