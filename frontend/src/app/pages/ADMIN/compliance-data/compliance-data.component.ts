import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import {
  ComplianceService,
  StoredCountry,
  CountryImportResult,
  StoredPort,
  PortImportResult
} from '../../../core/services/compliance.service';

@Component({
  selector: 'app-compliance-data',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './compliance-data.component.html',
  styleUrl: './compliance-data.component.scss'
})
export class ComplianceDataComponent implements OnInit {
  activeTab: 'countries' | 'ports' = 'countries';

  countries: StoredCountry[] = [];
  isLoadingCountries = false;
  loadError = '';

  isUploading = false;
  uploadError = '';
  lastImportResult: CountryImportResult | null = null;

  // Ports tab - own loading/error/upload state, same shape as countries,
  // deliberately not shared so a failure in one tab never affects the other.
  ports: StoredPort[] = [];
  isLoadingPorts = false;
  portsLoaded = false;
  portLoadError = '';

  isUploadingPort = false;
  portUploadError = '';
  lastPortImportResult: PortImportResult | null = null;

  constructor(private complianceService: ComplianceService) {}

  ngOnInit(): void {
    this.loadCountries();
  }

  setActiveTab(tab: 'countries' | 'ports'): void {
    this.activeTab = tab;
    // Lazy-load ports only the first time that tab is opened - no point
    // fetching a list the user may never look at.
    if (tab === 'ports' && !this.portsLoaded) {
      this.loadPorts();
    }
  }

  loadPorts(): void {
    this.isLoadingPorts = true;
    this.portLoadError = '';

    this.complianceService.getAllPorts().subscribe({
      next: (ports) => {
        this.ports = [...ports].sort((a, b) => b.verifiedDate.localeCompare(a.verifiedDate));
        this.isLoadingPorts = false;
        this.portsLoaded = true;
      },
      error: (err) => {
        this.isLoadingPorts = false;
        this.portLoadError = err?.status === 0
          ? 'The examination service is not reachable.'
          : `Could not load the port list (server returned ${err?.status ?? 'an error'}).`;
      }
    });
  }

  async onPortFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploadingPort = true;
    this.portUploadError = '';
    this.lastPortImportResult = null;

    try {
      this.lastPortImportResult = await firstValueFrom(this.complianceService.importPorts(file));
      this.loadPorts();
    } catch (err: any) {
      this.portUploadError = err?.status === 0
        ? 'The examination service is not reachable — nothing was imported.'
        : (err?.error?.error ?? `Import failed (server returned ${err?.status ?? 'an error'}).`);
    } finally {
      this.isUploadingPort = false;
      (event.target as HTMLInputElement).value = '';
    }
  }

  loadCountries(): void {
    this.isLoadingCountries = true;
    this.loadError = '';

    this.complianceService.getAllCountries().subscribe({
      next: (countries) => {
        // Newest/most-recently-touched entries first, so an upload's
        // effect is immediately visible without hunting through the list.
        this.countries = [...countries].sort((a, b) =>
          b.verifiedDate.localeCompare(a.verifiedDate));
        this.isLoadingCountries = false;
      },
      error: (err) => {
        this.isLoadingCountries = false;
        this.loadError = err?.status === 0
          ? 'The examination service is not reachable.'
          : `Could not load the country list (server returned ${err?.status ?? 'an error'}).`;
      }
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isUploading = true;
    this.uploadError = '';
    this.lastImportResult = null;

    try {
      this.lastImportResult = await firstValueFrom(this.complianceService.importCountries(file));
      this.loadCountries();
    } catch (err: any) {
      this.uploadError = err?.status === 0
        ? 'The examination service is not reachable — nothing was imported.'
        : (err?.error?.error ?? `Import failed (server returned ${err?.status ?? 'an error'}).`);
    } finally {
      this.isUploading = false;
      // Lets the same file be re-selected immediately (e.g. after fixing
      // and re-uploading) — without this, selecting the same filename
      // twice in a row doesn't fire a change event.
      (event.target as HTMLInputElement).value = '';
    }
  }

  listTypeLabel(listType: string): string {
    switch (listType) {
      case 'OFAC_SANCTIONS': return 'OFAC';
      case 'FATF_AML_RISK': return 'FATF';
      case 'BANK_PROVIDED': return 'Bank-provided';
      default: return listType;
    }
  }

  severityFor(tier: string): 'critical' | 'warning' {
    return ['COMPREHENSIVE', 'FATF_BLACKLIST', 'BANK_SANCTIONED'].includes(tier)
      ? 'critical' : 'warning';
  }

  /** Port tiers are just SANCTIONED/HIGH_RISK — a smaller, separate set from country tiers above. */
  severityForPort(tier: string): 'critical' | 'warning' {
    return tier === 'SANCTIONED' ? 'critical' : 'warning';
  }

  /** Shortens PortDataSeeder's long disclaimer string for the table's Source column — full text stays in the tooltip. */
  portSourceLabel(source: string): string {
    return source?.startsWith('Sample/test data') ? 'Sample data' : source;
  }
}
