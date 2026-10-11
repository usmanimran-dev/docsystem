/**
 * Mirrors UserMasterRequestDTO / UserMasterResponseDTO on the backend.
 *
 * Two things differ from the department master:
 *  - the "who is acting" field is `appuser` here, not `appuserid`
 *  - the record status field is `recstatus`, not `recordstatus`
 */
export interface UserRequest {
  loginid: string;
  password: string;
  username: string;
  userstatus: string;
  usercat: string;
  authtype: string;
  departmentcode: string;
  contactno: string;
  emailid: string;
  mailingaddress: string;
  employeeid: string;
  // Required on approve: the backend rejects the call when the approver is
  // the same person who submitted it ("Maker checker Could not be same").
  appuser: string | null;
}

export interface UserRecord {
  loginid: string;
  username: string;
  userstatus: string;
  recstatus: string;
  usercat: string;
  usercategory: string | null;
  departmentcode: string | null;
  contactno: string | null;
  emailid: string | null;
  mailingaddress: string | null;
  legalid: string | null;
  branchid: string | null;
  machinename: string | null;
  actioncode: string | null;
  rejectreason: string | null;
  createdon: string | null;
  createdby: string | null;
  inputterid: string | null;
  inputterdttm: string | null;
  authorizerid: string | null;
  authorizerdttm: string | null;
}
