import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DocumentTypeRecord, DOC_TYPE_RECORD_STATUS } from '../../../core/models/document-type.model';

@Component({
  selector: 'app-document-type-inquiries',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './document-type-inquiries.component.html',
  styleUrls: ['./document-type-inquiries.component.scss']
})
export class DocumentTypeInquiriesComponent implements OnInit {

  searchQuery = '';
  activeTab: string = DOC_TYPE_RECORD_STATUS.SAVED;
  loading = false;
  errorMessage = '';

  // Each tab is its own endpoint, not a client-side filter.
  tabs = [
    { key: DOC_TYPE_RECORD_STATUS.SAVED, label: 'Pending' },
    { key: DOC_TYPE_RECORD_STATUS.SUBMITTED, label: 'Submitted' },
    { key: DOC_TYPE_RECORD_STATUS.APPROVED, label: 'Approved' }
  ];

  allDocumentTypes: DocumentTypeRecord[] = [];
  filteredDocumentTypes: DocumentTypeRecord[] = [];

  currentPage = 1;
  itemsPerPage = 10;

  sortColumn: keyof DocumentTypeRecord | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadDocumentTypes();
  }

  loadDocumentTypes(): void {
    this.loading = true;
    this.errorMessage = '';

    let request: Observable<DocumentTypeRecord[]>;
    if (this.activeTab === DOC_TYPE_RECORD_STATUS.SUBMITTED) {
      request = this.api.getSubmittedDocumentTypes();
    } else if (this.activeTab === DOC_TYPE_RECORD_STATUS.APPROVED) {
      request = this.api.getApprovedDocumentTypes();
    } else {
      request = this.api.getPendingDocumentTypes();
    }

    request.subscribe({
      next: (records) => {
        this.loading = false;
        this.allDocumentTypes = records ?? [];
        this.applyFilters();
      },
      error: (err) => {
        this.loading = false;
        this.allDocumentTypes = [];
        this.filteredDocumentTypes = [];
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Could not load document types';
      }
    });
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredDocumentTypes = this.allDocumentTypes.filter(d =>
      !q ||
      (d.documenttypeid ?? '').toLowerCase().includes(q) ||
      (d.documenttype ?? '').toLowerCase().includes(q)
    );

    this.sortData();
    this.currentPage = 1;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.loadDocumentTypes();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  sortBy(column: keyof DocumentTypeRecord): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    if (!this.sortColumn) return;

    this.filteredDocumentTypes.sort((a, b) => {
      const valA = String(a[this.sortColumn!] ?? '');
      const valB = String(b[this.sortColumn!] ?? '');
      return this.sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDocumentTypes.length / this.itemsPerPage));
  }

  get pagedDocumentTypes(): DocumentTypeRecord[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDocumentTypes.slice(start, start + this.itemsPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  statusLabel(recordstatus: string): string {
    if (recordstatus === DOC_TYPE_RECORD_STATUS.SUBMITTED) return 'Submitted';
    if (recordstatus === DOC_TYPE_RECORD_STATUS.APPROVED) return 'Approved';
    return 'Pending';
  }

  openDocumentType(docType: DocumentTypeRecord): void {
    this.router.navigate(['/adminPanel/CreateDocumentType'], { state: { record: docType } });
  }

  trackById(_: number, docType: DocumentTypeRecord): string {
    return docType.documenttypeid;
  }
}
