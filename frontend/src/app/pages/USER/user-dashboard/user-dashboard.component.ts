import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { DocumentRecord } from '../../../core/models/document.model';
import { DocumentViewerService } from '../../../core/services/document-viewer.service';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatCardModule
  ],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss'
})
export class UserDashboardComponent implements OnDestroy {
  searchTerm = '';
  results: DocumentRecord[] = [];
  loading = false;
  error = '';
  openingDocId: string | null = null;
  private search$ = new Subject<string>();
  private sub: Subscription;

  constructor(private api: ApiService, private viewer: DocumentViewerService) {
    // Same lookup as "Search By Ref ID": every document under a master
    // (transaction) reference. The error is handled inside the inner
    // observable so one failed search does not end the stream and leave the
    // box dead until the page is reloaded.
    this.sub = this.search$.pipe(
      debounceTime(300),
      switchMap(term => {
        const ref = term.trim();
        this.error = '';
        if (!ref) {
          this.loading = false;
          return of<DocumentRecord[]>([]);
        }
        this.loading = true;
        return this.api.getDocumentsByTnxReference(ref).pipe(
          catchError(err => {
            // "Nothing matched" comes back as a 400 with a message, not an
            // empty list, so it is an empty result rather than a failure.
            if (err?.status !== 400) {
              this.error = err?.status === 0 ? 'Cannot reach the server.' : 'Failed to fetch results';
            }
            return of<DocumentRecord[]>([]);
          })
        );
      })
    ).subscribe(items => {
      this.results = items ?? [];
      this.loading = false;
    });
  }

  openDocument(doc: DocumentRecord) {
    this.openingDocId = doc.docid;
    this.error = '';

    this.api.searchDocument(doc.docid).subscribe({
      next: (blob) => {
        this.openingDocId = null;
        this.viewer.open(blob, doc.filename || doc.docid, doc.documentType);
      },
      error: () => {
        this.openingDocId = null;
        this.error = `Could not open ${doc.filename || doc.docid}`;
      }
    });
  }

  onSearch() {
    this.search$.next(this.searchTerm);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}

