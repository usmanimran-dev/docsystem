/**
 * Shape returned by the document listing endpoints
 * (/mydms/listdocumentsbyref and /mydms/listdocumentsbytnxreference).
 * Mirrors DocumentMasterResponseData on the backend.
 */
export interface DocumentRecord {
  docid: string;
  filename: string;
  documentType: string;
  description: string;
  // docdoccat is the business document type ("Invoice", "Airway bill" …);
  // documenttype is the file format and the backend derives it from the
  // uploaded file. There is no separate doctype field — Imad confirmed it
  // is not used.
  docdoccat: string;
  documentstatus: string;
  tnxreference: string;
  tnxreferenceaction: string;
  eventreference: string;
}
