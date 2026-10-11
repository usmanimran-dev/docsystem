import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import {
  DocumentAnalysisService,
  AnalysisSummary
} from '../../../core/services/document-analysis.service';
import {
  DiscrepancyService,
  DiscrepancyReport
} from '../../../core/services/discrepancy.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-discrepancy-check',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './discrepancy-check.component.html',
  styleUrl: './discrepancy-check.component.scss'
})
export class DiscrepancyCheckComponent implements OnInit {

  analyses: AnalysisSummary[] = [];
  isLoadingAnalyses = false;
  loadError = '';

  documentAId = '';
  documentBId = '';
  lcReference = '';

  isChecking = false;
  checkError = '';
  report: DiscrepancyReport | null = null;

  constructor(
    private analysisService: DocumentAnalysisService,
    private discrepancyService: DiscrepancyService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadAnalyses();
  }

  async loadAnalyses(): Promise<void> {
    this.isLoadingAnalyses = true;
    this.loadError = '';
    try {
      const page = await firstValueFrom(this.analysisService.list(0, 100));
      this.analyses = page.content;
    } catch {
      this.loadError = 'Could not load the list of analysed documents.';
    } finally {
      this.isLoadingAnalyses = false;
    }
  }

  get canCheck(): boolean {
    return !!this.documentAId
        && !!this.documentBId
        && this.documentAId !== this.documentBId
        && !this.isChecking;
  }

  async runCheck(): Promise<void> {
    if (!this.canCheck) return;

    this.isChecking = true;
    this.checkError = '';
    this.report = null;

    try {
      this.report = await firstValueFrom(this.discrepancyService.check({
        documentAId: this.documentAId,
        documentBId: this.documentBId,
        lcReference: this.lcReference.trim() || undefined,
        checkedBy: this.currentLoginId()
      }));
    } catch {
      this.checkError = 'The comparison could not be completed. Check that the examination service is running.';
    } finally {
      this.isChecking = false;
    }
  }

  reset(): void {
    this.report = null;
    this.checkError = '';
  }

  /** Conflicts first, then review, then matches - the rows that need action lead. */
  get sortedResults() {
    if (!this.report) return [];
    const order: Record<string, number> = { CONFLICT: 0, REVIEW: 1, MATCH: 2 };
    return [...this.report.results].sort(
      (a, b) => order[a.verdict] - order[b.verdict]);
  }

  labelFor(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, c => c.toUpperCase())
      .trim();
  }

  filenameFor(id: string): string {
    return this.analyses.find(a => a.id === id)?.filename ?? id;
  }

  private currentLoginId(): string {
    const token = this.auth.getToken();
    if (!token) return 'SYSTEM';
    try {
      return JSON.parse(atob(token.split('.')[1] || ''))?.sub || 'SYSTEM';
    } catch {
      return 'SYSTEM';
    }
  }
}
