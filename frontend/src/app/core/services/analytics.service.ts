import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NameCount {
  name: string;
  count: number;
}

export interface DayPoint {
  day: string;
  analyses: number;
  avgExtractionConfidence: number;
  avgReadConfidence: number;
  avgFieldsExtracted: number;
}

export interface DocumentTypeCount {
  documentType: string;
  count: number;
  avgConfidence: number;
}

export interface FieldCoverage {
  fieldName: string;
  present: number;
  /** 0–1. Returned worst-first: this is read to pick the next pattern to fix. */
  coverage: number;
}

export interface TypeFieldCoverage {
  documentType: string;
  totalDocuments: number;
  fields: FieldCoverage[];
}

export interface IssueCount {
  type: string;
  field: string;
  severity: string;
  count: number;
}

export interface AnalyticsOverview {
  generatedAt: string;
  windowDays: number;
  totals: {
    analyses: number;
    distinctDocuments: number;
    discrepancyReports: number;
    analysesWithCriticalIssues: number;
  };
  confidenceTrend: DayPoint[];
  documentTypes: DocumentTypeCount[];
  fieldCoverage: TypeFieldCoverage[];
  validation: {
    byStatus: NameCount[];
    topIssues: IssueCount[];
  };
  discrepancies: {
    reports: number;
    clean: number;
    withFindings: number;
    totalConflicts: number;
    totalReviews: number;
    topConflictFields: NameCount[];
  };
  duplication: {
    analyses: number;
    distinctFileHashes: number;
    distinctContentKeys: number;
    repeatAnalyses: number;
  };
  fileTypes: NameCount[];
}

/**
 * Read-only monitoring figures from the examination service.
 *
 * There is deliberately no write method here: the admin dashboard reports on
 * stored analyses and never alters one.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {

  private readonly baseUrl = environment.examineApiUrl;

  constructor(private http: HttpClient) {}

  /** Pass 0 for days to get everything ever recorded. */
  overview(days: number): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(`${this.baseUrl}/analytics/overview?days=${days}`);
  }
}
