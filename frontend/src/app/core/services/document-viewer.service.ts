import { Injectable } from '@angular/core';

/** How long an object URL opened in a new tab stays alive before being freed. */
const REVOKE_DELAY_MS = 60_000;

/**
 * Shows a document the backend returned as a Blob: images and PDFs open in a
 * new tab, anything else downloads.
 *
 * This lives in one place because four screens (Search by Doc ID, Search by
 * Ref ID, Document Status and the dashboard) all did the same thing, and all
 * of them leaked: the object URL handed to window.open was never revoked, so
 * every document opened held its bytes in memory until the page was reloaded.
 */
@Injectable({ providedIn: 'root' })
export class DocumentViewerService {

  /**
   * @param fallbackType used when the server sends no Content-Type, which the
   *        DMS does for some records.
   */
  open(blob: Blob, filename: string, fallbackType = ''): void {
    const type = blob.type || fallbackType;

    if (type.startsWith('image/') || type === 'application/pdf') {
      this.openInNewTab(blob, filename);
      return;
    }
    this.download(blob, filename);
  }

  private openInNewTab(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const tab = window.open(url, '_blank');

    if (!tab) {
      // Popup blocked. Downloading is better than the silent nothing the
      // callers used to do - one of them then called win!.document.write and
      // threw instead.
      URL.revokeObjectURL(url);
      this.download(blob, filename);
      return;
    }

    // The new tab still needs the URL while it loads, so this cannot be
    // revoked straight away. A timer is the practical option: there is no
    // reliable cross-browser load event for a tab showing a blob.
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  }

  download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
