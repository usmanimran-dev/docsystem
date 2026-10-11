// recordstatus values used by the backend maker-checker flow.
// Verified against the running service: save -> I, submit -> S, approve -> A.
export const RECORD_STATUS = {
  SAVED: 'I',
  SUBMITTED: 'S',
  APPROVED: 'A'
} as const;

/**
 * Trimmed shape returned by /departmentlist — only what a dropdown needs.
 * The endpoint returns approved departments only.
 */
export interface DepartmentListItem {
  departmentcode: string;
  departmentname: string;
}

export interface DepartmentRequest {
  departmentcode: string;
  departmentname: string;
  departmentstatus: string;
  appuserid: string | null;
}

export interface DepartmentRecord {
  departmentcode: string;
  departmentname: string;
  departmentstatus: string;
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
