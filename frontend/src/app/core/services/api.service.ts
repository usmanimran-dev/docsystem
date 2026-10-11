import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DepartmentListItem, DepartmentRecord, DepartmentRequest } from '../models/department.model';
import { DocumentRecord } from '../models/document.model';
import { DocumentTypeListItem, DocumentTypeRecord, DocumentTypeRequest } from '../models/document-type.model';
import { UserRecord, UserRequest } from '../models/user.model';
import { logger } from '../logging/logger';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private readonly baseUrl = environment.apiUrl;
  private readonly productBaseUrl = environment.productApiUrl;

  constructor(private http: HttpClient) { }

  searchDocument(documentId: string): Observable<Blob> {
    const url = `${this.baseUrl}/mydms/searchdocument/${documentId}`;
    logger.debug('Fetching document →', url);
    return this.http.get(url, { responseType: 'blob' });
  }

  // Documents by workflow stage. None of these take a search parameter —
  // they return the full list for that stage, so filtering happens client side.
  getPendingDocuments(): Observable<DocumentRecord[]> {
    return this.http.get<DocumentRecord[]>(this.buildUrl('pendingdocuments'));
  }

  getSubmittedDocuments(): Observable<DocumentRecord[]> {
    return this.http.get<DocumentRecord[]>(this.buildUrl('submitteddocuments'));
  }

  getApprovedDocuments(): Observable<DocumentRecord[]> {
    return this.http.get<DocumentRecord[]>(this.buildUrl('approveddocuments'));
  }

  // Documents for a master/transaction reference, without needing an event
  // reference. Returns 400 with a message when nothing matches, rather than
  // an empty list.
  getDocumentsByTnxReference(tnxreference: string): Observable<DocumentRecord[]> {
    const url = this.buildUrl(
      `mydms/listdocumentsbytnxreference?tnxreference=${encodeURIComponent(tnxreference)}`
    );
    return this.http.get<DocumentRecord[]>(url);
  }

  getDocumentsByRef(tnxreference: string, eventreference: string) {
    const endpoint = `mydms/listdocumentsbyref?tnxreference=${encodeURIComponent(tnxreference)}&eventreference=${encodeURIComponent(eventreference)}`;
    const url = this.buildUrl(endpoint);
    logger.debug('GET documents →', url);
    return this.http.get<any[]>(url);
  }

  addProduct(productCode: string): Observable<string> {
    // The backend replies with a plain-text confirmation ("Product Added:
    // ..."), not JSON - HttpClient defaults to parsing the body as JSON
    // and throws "Http failure during parsing" on a plain-text 200,
    // masking a request that actually succeeded.
    return this.http.post(
      `${this.productBaseUrl}/addproduct`,
      {
        productcode: productCode
      },
      { responseType: 'text' }
    );
  }

  // ############### Department master ###############
  saveDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(this.buildUrl('savedepartment'), payload);
  }

  updateDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(this.buildUrl('updatedepartment'), payload);
  }

  submitDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(this.buildUrl('submitdepartment'), payload);
  }

  approveDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(this.buildUrl('approvedepartment'), payload);
  }

  rejectDepartment(payload: DepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(this.buildUrl('rejectdepartment'), payload);
  }

  getPendingDepartments(): Observable<DepartmentRecord[]> {
    return this.http.get<DepartmentRecord[]>(this.buildUrl('pendingdepartment'));
  }

  getSubmittedDepartments(): Observable<DepartmentRecord[]> {
    return this.http.get<DepartmentRecord[]>(this.buildUrl('submitteddepartment'));
  }

  getApprovedDepartments(): Observable<DepartmentRecord[]> {
    return this.http.get<DepartmentRecord[]>(this.buildUrl('approveddepartment'));
  }

  // Approved departments only, trimmed to code + name — used to populate
  // the department dropdown on the user creation screen.
  getDepartmentList(): Observable<DepartmentListItem[]> {
    return this.http.get<DepartmentListItem[]>(this.buildUrl('departmentlist'));
  }

  searchDepartmentById(departmentid: string): Observable<DepartmentRecord> {
    return this.http.get<DepartmentRecord>(this.buildUrl(`searchdepartment/${departmentid}`));
  }

  // ############### Document Type master ###############
  // Endpoint names/fields below match the backend exactly, typos included -
  // verified live: submittedddocumenttype has three d's, documentypestatus
  // is missing a "t". "Fixing" the spelling here would just 404.
  saveDocumentType(payload: DocumentTypeRequest): Observable<DocumentTypeRecord> {
    return this.http.post<DocumentTypeRecord>(this.buildUrl('savedocumenttype'), payload);
  }

  updateDocumentType(payload: DocumentTypeRequest): Observable<DocumentTypeRecord> {
    return this.http.post<DocumentTypeRecord>(this.buildUrl('updatedocumenttype'), payload);
  }

  submitDocumentType(payload: DocumentTypeRequest): Observable<DocumentTypeRecord> {
    return this.http.post<DocumentTypeRecord>(this.buildUrl('submitdocumenttype'), payload);
  }

  approveDocumentType(payload: DocumentTypeRequest): Observable<DocumentTypeRecord> {
    return this.http.post<DocumentTypeRecord>(this.buildUrl('approvedocumenttype'), payload);
  }

  rejectDocumentType(payload: DocumentTypeRequest): Observable<DocumentTypeRecord> {
    return this.http.post<DocumentTypeRecord>(this.buildUrl('rejectdocumenttype'), payload);
  }

  getPendingDocumentTypes(): Observable<DocumentTypeRecord[]> {
    return this.http.get<DocumentTypeRecord[]>(this.buildUrl('pendingdocumenttype'));
  }

  getSubmittedDocumentTypes(): Observable<DocumentTypeRecord[]> {
    return this.http.get<DocumentTypeRecord[]>(this.buildUrl('submittedddocumenttype'));
  }

  getApprovedDocumentTypes(): Observable<DocumentTypeRecord[]> {
    return this.http.get<DocumentTypeRecord[]>(this.buildUrl('approveddocumenttype'));
  }

  searchDocumentTypeById(documenttypeid: string): Observable<DocumentTypeRecord> {
    return this.http.get<DocumentTypeRecord>(this.buildUrl(`searchdocumenttype/${documenttypeid}`));
  }

  getDocumentTypeList(): Observable<DocumentTypeListItem[]> {
    return this.http.get<DocumentTypeListItem[]>(this.buildUrl('documenttypelist'));
  }

  // ############### User master ###############
  saveUser(payload: UserRequest): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.buildUrl('saveuser'), payload);
  }

  updateUser(payload: UserRequest): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.buildUrl('updateuser'), payload);
  }

  submitUser(payload: UserRequest): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.buildUrl('submituser'), payload);
  }

  approveUser(payload: UserRequest): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.buildUrl('approveuser'), payload);
  }

  rejectUser(payload: UserRequest): Observable<UserRecord> {
    return this.http.post<UserRecord>(this.buildUrl('rejectuser'), payload);
  }

  getPendingUsers(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(this.buildUrl('pendingusers'));
  }

  // Takes the *current* user's login id: the backend hides records this
  // person submitted, since they are not allowed to approve their own.
  getSubmittedUsers(loginid: string): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(
      this.buildUrl(`submittedusers?loginid=${encodeURIComponent(loginid)}`)
    );
  }

  getApprovedUsers(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(this.buildUrl('approvedusers'));
  }

  searchUserById(loginid: string): Observable<UserRecord> {
    return this.http.get<UserRecord>(this.buildUrl(`searchusers/${loginid}`));
  }

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}/${endpoint}`;
  }

  postData(endpoint: string, data: any): Observable<any> {
    const url = this.buildUrl(endpoint);
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    // The body is deliberately not logged: login() posts through here, so
    // logging it wrote the login id and plaintext password to the console.
    logger.debug('POST →', url);
    return this.http.post(url, data, { headers });
  }

  getData(endpoint: string): Observable<any> {
    const url = this.buildUrl(endpoint);
    logger.debug('GET →', url);
    return this.http.get(url);
  }
}
