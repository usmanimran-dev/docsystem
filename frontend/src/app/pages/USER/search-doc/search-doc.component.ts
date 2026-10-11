import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';
import { DocumentViewerService } from '../../../core/services/document-viewer.service';

/** Fetches one document by its DMS document id and shows it. */
@Component({
  selector: 'app-search-doc',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIcon
  ],
  templateUrl: './search-doc.component.html',
  styleUrls: ['./search-doc.component.scss'],
})
export class SearchDocComponent {
  searchTerm = '';
  loading = false;
  resultMessage = '';

  constructor(private api: ApiService, private viewer: DocumentViewerService) { }

  onSearch() {
    const documentId = this.searchTerm.trim();
    if (!documentId) {
      this.resultMessage = 'Please enter a Document ID.';
      return;
    }

    this.loading = true;
    this.resultMessage = '';

    this.api.searchDocument(documentId).subscribe({
      next: (blob) => {
        this.loading = false;
        // Images and PDFs open in a new tab, anything else downloads.
        this.viewer.open(blob, documentId);
        this.resultMessage = 'Document opened.';
      },
      error: () => {
        this.loading = false;
        this.resultMessage = 'Failed to fetch document. Please check the ID.';
      }
    });
  }
}
