import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type DiscrepancyVerdict = 'MATCH' | 'CONFLICT' | 'REVIEW';

export interface DiscrepancyLine {
  fieldName: string;
  valueA: string;
  valueB: string;
  /** The form actually compared, after normalisation — explains a MATCH on values that look different. */
  normalizedA: string | null;
  normalizedB: string | null;
  confidenceA: number;
  confidenceB: number;
  verdict: DiscrepancyVerdict;
  /** Set on REVIEW lines to say why it was not called a conflict. */
  note?: string;
}

export interface DiscrepancyReport {
  id: string;
  documentAId: string;
  documentAFilename: string | null;
  documentBId: string;
  documentBFilename: string | null;
  lcReference: string | null;
  checkedBy: string | null;
  createdAt: string;
  totalCompared: number;
  matchCount: number;
  conflictCount: number;
  reviewCount: number;
  verdict: 'CLEAN' | 'DISCREPANCIES_FOUND';
  results: DiscrepancyLine[];
}

export interface DiscrepancyCheckRequest {
  documentAId: string;
  documentBId: string;
  lcReference?: string;
  checkedBy?: string;
}

/**
 * Cross-document discrepancy checking against the examination service.
 *
 * Only document ids are sent — the server reads the saved analyses itself,
 * so the comparison always runs against what was actually extracted.
 */
@Injectable({ providedIn: 'root' })
export class DiscrepancyService {

  private readonly baseUrl = environment.examineApiUrl;

  constructor(private http: HttpClient) {}

  check(request: DiscrepancyCheckRequest): Observable<DiscrepancyReport> {
    return this.http.post<DiscrepancyReport>(`${this.baseUrl}/discrepancy/check`, request);
  }

  getById(id: string): Observable<DiscrepancyReport> {
    return this.http.get<DiscrepancyReport>(`${this.baseUrl}/discrepancy/${id}`);
  }

  findByLcReference(lcReference: string): Observable<DiscrepancyReport[]> {
    return this.http.get<DiscrepancyReport[]>(
      `${this.baseUrl}/discrepancy/by-lc/${encodeURIComponent(lcReference)}`);
  }
}
