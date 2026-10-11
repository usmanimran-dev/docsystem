import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SaveAnalysisRequest {
  filename: string;
  fileType: string;
  fileHash: string;
  /** Null when the extractor could not build a reliable one - see DuplicateDetectionService. */
  contentKey: string | null;
  ocrResult: { text: string; confidence: number } | null;
  fieldExtraction: {
    documentType: string;
    overallConfidence: number;
    fields: Array<{ fieldName: string; value: string; confidence: number }>;
  } | null;
  duplicateCheck: {
    duplicate: boolean;
    hash: string;
    existingDocumentId: string | null;
    matchType: string | null;
  } | null;
  anomalyReport: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    overallStatus: string;
    issues: Array<{
      id: string; type: string; severity: string; field: string;
      message: string; value?: string; suggestion?: string;
    }>;
  } | null;
  manualExtractions: Array<{
    id: string; text: string;
    x1: number; y1: number; x2: number; y2: number;
    timestamp: string;
  }>;
}

export interface AnalysisResponse extends SaveAnalysisRequest {
  id: string;
  analysedAt: string;
}

export interface AnalysisSummary {
  id: string;
  filename: string;
  fileType: string;
  analysedAt: string;
  documentType: string;
  overallStatus: string;
  totalIssues: number;
}

export interface AnalysisPage {
  content: AnalysisSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * Persists Document Reader results to edms-examination-service so they
 * survive a refresh and are visible beyond the browser that produced them.
 *
 * Errors are deliberately NOT swallowed here - unlike the compliance check,
 * where failing soft is reasonable, a silent save failure would leave someone
 * believing their analysis was stored when it wasn't. The caller decides how
 * to surface it.
 */
@Injectable({
  providedIn: 'root'
})
export class DocumentAnalysisService {
  private readonly baseUrl = environment.examineApiUrl;

  constructor(private http: HttpClient) {}

  save(request: SaveAnalysisRequest): Observable<AnalysisResponse> {
    return this.http.post<AnalysisResponse>(`${this.baseUrl}/documents`, request);
  }

  getById(id: string): Observable<AnalysisResponse> {
    return this.http.get<AnalysisResponse>(`${this.baseUrl}/documents/${id}`);
  }

  list(page = 0, size = 20): Observable<AnalysisPage> {
    return this.http.get<AnalysisPage>(`${this.baseUrl}/documents?page=${page}&size=${size}`);
  }

  /**
   * Every prior analysis of a file with this exact hash, newest first -
   * server-wide, not limited to the browser that's asking. This is what
   * duplicate detection is built on now: the same file uploaded from any
   * browser or device is recognised, not just repeats within one browser's
   * own history.
   */
  findByHash(fileHash: string): Observable<AnalysisSummary[]> {
    return this.http.get<AnalysisSummary[]>(`${this.baseUrl}/documents/by-hash/${fileHash}`);
  }

  /** The re-scanned-document case: same content fingerprint, different bytes. */
  findByContentKey(contentKey: string): Observable<AnalysisSummary[]> {
    return this.http.get<AnalysisSummary[]>(`${this.baseUrl}/documents/by-content-key/${contentKey}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/documents/${id}`);
  }

  /**
   * Stores the analysed document itself against a saved analysis, so a
   * reload can show the document again rather than an empty reader with
   * a record id attached to nothing visible.
   */
  uploadFile(id: string, file: File): Observable<{ fileId: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ fileId: string }>(`${this.baseUrl}/documents/${id}/file`, form);
  }

  /** 404s when the analysis was saved without its file. */
  downloadFile(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/documents/${id}/file`, { responseType: 'blob' });
  }
}
