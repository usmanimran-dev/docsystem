import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';
import { DocumentRecord } from '../../../core/models/document.model';
import { DocumentViewerService } from '../../../core/services/document-viewer.service';

@Component({
  selector: 'app-search-ref',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './search-ref.component.html',
  styleUrls: ['./search-ref.component.scss'],
})
export class SearchRefComponent {
  masterRef = '';
  eventRef = '';

  documents: DocumentRecord[] = [];
  loading = false;
  searched = false;
  message = '';

  // Only the row being opened shows its own progress text.
  openingDocId: string | null = null;

  constructor(private api: ApiService, private viewer: DocumentViewerService) { }

  onSearch() {
    const master = this.masterRef.trim();
    const event = this.eventRef.trim();

    if (!master) {
      this.message = 'Please enter a Master Reference';
      return;
    }

    this.loading = true;
    this.searched = true;
    this.documents = [];
    this.message = '';

    // With an event reference the search is narrowed to that event; without
    // one, every document under the master reference is returned.
    const request$ = event
      ? this.api.getDocumentsByRef(master, event)
      : this.api.getDocumentsByTnxReference(master);

    request$.subscribe({
      next: (res: DocumentRecord[]) => {
        this.documents = res ?? [];
        this.loading = false;
        if (this.documents.length === 0) {
          this.message = `No documents found for ${master}`;
        }
      },
      error: (err) => {
        this.loading = false;
        this.documents = [];
        // "Nothing matched" comes back as a 400 with a message rather than an
        // empty list, so it is shown as an empty result, not a failure.
        this.message =
          err?.status === 400 && err?.error?.message
            ? err.error.message
            : err?.status === 0
              ? 'Cannot reach the server.'
              : 'Could not fetch documents.';
      }
    });
  }

  onClear() {
    this.masterRef = '';
    this.eventRef = '';
    this.documents = [];
    this.searched = false;
    this.message = '';
  }

  openDocument(doc: DocumentRecord) {
    this.openingDocId = doc.docid;

    this.api.searchDocument(doc.docid).subscribe({
      next: (blob) => {
        this.openingDocId = null;
        this.viewer.open(blob, doc.filename || doc.docid, doc.documentType);
      },
      error: () => {
        this.openingDocId = null;
        this.message = `Could not open ${doc.filename || doc.docid}`;
      }
    });
  }

  trackByDocId(_: number, doc: DocumentRecord): string {
    return doc.docid;
  }
}
