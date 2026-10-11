import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DocumentRecord } from '../../../core/models/document.model';
import { DocumentViewerService } from '../../../core/services/document-viewer.service';

type DocumentStage = 'pending' | 'submitted' | 'approved';

@Component({
  selector: 'app-document-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './document-status.component.html',
  styleUrls: ['./document-status.component.scss'],
})
export class DocumentStatusComponent implements OnInit {
  // The three stages share this screen; the route says which one to load.
  stage: DocumentStage = 'pending';
  heading = '';

  allDocuments: DocumentRecord[] = [];
  filteredDocuments: DocumentRecord[] = [];

  searchQuery = '';
  loading = false;
  message = '';
  openingDocId: string | null = null;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private viewer: DocumentViewerService
  ) { }

  ngOnInit(): void {
    // Re-reading on every param change means navigating between the three
    // pages reloads the list instead of reusing the previous one.
    this.route.data.subscribe(data => {
      this.stage = (data['stage'] as DocumentStage) ?? 'pending';
      this.heading = this.stage.charAt(0).toUpperCase() + this.stage.slice(1) + ' Documents';
      this.searchQuery = '';
      this.loadDocuments();
    });
  }

  loadDocuments(): void {
    this.loading = true;
    this.message = '';
    this.allDocuments = [];
    this.filteredDocuments = [];

    const request$: Observable<DocumentRecord[]> =
      this.stage === 'submitted' ? this.api.getSubmittedDocuments()
        : this.stage === 'approved' ? this.api.getApprovedDocuments()
          : this.api.getPendingDocuments();

    request$.subscribe({
      next: (res: DocumentRecord[]) => {
        this.allDocuments = res ?? [];
        this.applyFilter();
        this.loading = false;
        if (this.allDocuments.length === 0) {
          this.message = `No ${this.stage} documents`;
        }
      },
      error: (err) => {
        this.loading = false;
        this.message = err?.status === 0
          ? 'Cannot reach the server.'
          : 'Could not load documents.';
      },
    });
  }

  // The endpoints take no search parameter, so filtering is done here on the
  // list already fetched.
  applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredDocuments = !q
      ? [...this.allDocuments]
      : this.allDocuments.filter(d =>
        (d.tnxreference ?? '').toLowerCase().includes(q) ||
        (d.filename ?? '').toLowerCase().includes(q) ||
        (d.docid ?? '').toLowerCase().includes(q)
      );
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilter();
  }

  openDocument(doc: DocumentRecord): void {
    this.openingDocId = doc.docid;

    this.api.searchDocument(doc.docid).subscribe({
      next: (blob) => {
        this.openingDocId = null;
        this.viewer.open(blob, doc.filename || doc.docid, doc.documentType);
      },
      error: () => {
        this.openingDocId = null;
        this.message = `Could not open ${doc.filename || doc.docid}`;
      },
    });
  }

  trackByDocId(_: number, doc: DocumentRecord): string {
    return doc.docid;
  }
}
