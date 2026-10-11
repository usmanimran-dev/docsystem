// recordstatus values used by the backend maker-checker flow.
// Verified against the running service: save -> I, submit -> S, approve -> A.
// Same convention as department.model.ts's RECORD_STATUS.
export const DOC_TYPE_RECORD_STATUS = {
  SAVED: 'I',
  SUBMITTED: 'S',
  APPROVED: 'A'
} as const;

export interface DocumentTypeListItem {
  documenttypeid: string;
  documenttype: string;
}

export interface DocumentTypeRequest {
  documenttypeid: string;
  documenttype: string;
  documentypestatus: string; // sic - matches the backend's field name exactly
  appuserid: string | null;
}

export interface DocumentTypeRecord {
  documenttypeid: string;
  documenttype: string;
  documentypestatus: string; // sic - matches the backend's field name exactly
  recordstatus: string;
  createdon: string | null;
  createdby: string | null;
  updatedon: string | null;
  updatedby: string | null;
  inputterid: string | null;
  inputterdttm: string | null;
  authorizerid: string | null;
  authorizerdttm: string | null;
}
