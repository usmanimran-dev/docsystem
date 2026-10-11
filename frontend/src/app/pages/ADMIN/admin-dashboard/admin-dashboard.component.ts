import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import {
  AnalyticsService,
  AnalyticsOverview,
  DayPoint,
  TypeFieldCoverage
} from '../../../core/services/analytics.service';

/** Windows offered in the header. 0 is "everything recorded". */
const WINDOWS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: 0 }
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {

  readonly windows = WINDOWS;
  selectedDays = 0;

  data: AnalyticsOverview | null = null;
  isLoading = false;
  loadError = '';

  /** Which document type's field coverage is expanded; only one at a time. */
  openCoverage = '';

  constructor(private analytics: AnalyticsService) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';
    try {
      this.data = await firstValueFrom(this.analytics.overview(this.selectedDays));
      this.openCoverage = this.data.fieldCoverage[0]?.documentType ?? '';
    } catch {
      this.loadError = 'Could not load monitoring data. Check that the examination service is running.';
      this.data = null;
    } finally {
      this.isLoading = false;
    }
  }

  selectWindow(days: number): void {
    if (days === this.selectedDays) return;
    this.selectedDays = days;
    this.load();
  }

  toggleCoverage(documentType: string): void {
    this.openCoverage = this.openCoverage === documentType ? '' : documentType;
  }

  // ---- chart helpers -------------------------------------------------
  // The trend is drawn as an inline SVG polyline rather than pulled in as a
  // chart library: two series over at most a few dozen points does not justify
  // the dependency, and the bundle already carries more than it should.

  readonly chart = { width: 720, height: 180, padX: 8, padY: 12 };

  /** Confidence is 0–1, so the y-axis is fixed rather than fitted to the data. */
  private pointsFor(values: number[]): string {
    const { width, height, padX, padY } = this.chart;
    const usable = width - padX * 2;
    const step = values.length > 1 ? usable / (values.length - 1) : 0;
    return values
      .map((v, i) => {
        const x = padX + i * step;
        const y = padY + (1 - Math.min(Math.max(v, 0), 1)) * (height - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  get extractionLine(): string {
    return this.pointsFor((this.data?.confidenceTrend ?? []).map(d => d.avgExtractionConfidence));
  }

  get readLine(): string {
    return this.pointsFor((this.data?.confidenceTrend ?? []).map(d => d.avgReadConfidence));
  }

  /** Fields-per-document shares the axis, scaled against its own maximum. */
  get fieldsLine(): string {
    const values = (this.data?.confidenceTrend ?? []).map(d => d.avgFieldsExtracted);
    const max = Math.max(1, ...values);
    return this.pointsFor(values.map(v => v / max));
  }

  get maxFields(): number {
    return Math.max(1, ...(this.data?.confidenceTrend ?? []).map(d => d.avgFieldsExtracted));
  }

  get trendDays(): DayPoint[] {
    return this.data?.confidenceTrend ?? [];
  }

  /** Enough of a gap between first and last day to be worth calling out. */
  get confidenceDelta(): number | null {
    const days = this.trendDays;
    if (days.length < 2) return null;
    return days[days.length - 1].avgExtractionConfidence - days[0].avgExtractionConfidence;
  }

  get openCoverageBlock(): TypeFieldCoverage | null {
    return this.data?.fieldCoverage.find(c => c.documentType === this.openCoverage) ?? null;
  }

  percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  /** Under half the documents of its own type is a pattern worth looking at. */
  isWeak(coverage: number): boolean {
    return coverage < 0.5;
  }

  labelFor(fieldName: string): string {
    return fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }

  typeLabel(documentType: string): string {
    return documentType.replace(/_/g, ' ');
  }

  barWidth(count: number, all: { count: number }[]): string {
    const max = Math.max(1, ...all.map(a => a.count));
    return `${Math.round((count / max) * 100)}%`;
  }
}
