import { Injectable } from '@angular/core';
import { sha256 } from 'js-sha256';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  /** How it matched: the exact same file, or the same document re-scanned. */
  matchType?: 'EXACT_FILE' | 'SAME_CONTENT';
  hash: string;
  contentKey?: string;
  existingDocumentId?: string;
  uploadedAt?: Date;
  /** Which fields produced a SAME_CONTENT match, for showing why it was flagged. */
  matchedOn?: string[];
}

/**
 * Two independent ways to recognise a document that has been seen before:
 *
 *   1. fileHash  - SHA-256 of the raw bytes. Exact, but only catches the
 *      identical file; re-scanning or re-exporting the same document
 *      changes every byte.
 *
 *   2. contentKey - a fingerprint of the document's own identifying fields.
 *      Catches the re-scanned case, where the bytes differ but it is still
 *      the same invoice/BOL/statement.
 *
 * Both are matched SERVER-WIDE (see DocumentAnalysisService), not against a
 * browser-local list.
 */
@Injectable({
  providedIn: 'root'
})
export class DuplicateDetectionService {

  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return sha256(buffer);
  }

  /**
   * Builds the content fingerprint, or returns null when the extracted
   * fields are too weak to identify a document safely.
   *
   * A reference number is REQUIRED, plus at least one corroborating field.
   * Matching on amount+date alone would false-positive constantly - two
   * different invoices for the same amount on the same day are ordinary in
   * trade finance, and wrongly calling those a duplicate is worse than
   * missing a real one. When a safe key can't be built, no key is stored
   * and content matching simply does not run for that document.
   */
  // Values are optional: the caller passes whatever the extractor found, which
  // is rarely every field. The normalise* helpers below already expect that.
  buildContentKey(fields: Record<string, string | undefined>): { key: string; matchedOn: string[] } | null {
    const reference = this.normaliseReference(fields['documentId'] ?? fields['statementId']);
    if (!reference) {
      return null;
    }

    const parts: string[] = [`ref=${reference}`];
    const matchedOn: string[] = [fields['documentId'] ? 'documentId' : 'statementId'];

    const amount = this.normaliseAmount(fields['amount']);
    if (amount) {
      parts.push(`amt=${amount}`);
      matchedOn.push('amount');
    }

    const date = this.normaliseDate(fields['date']);
    if (date) {
      parts.push(`date=${date}`);
      matchedOn.push('date');
    }

    const account = this.normaliseReference(fields['accountNumber']);
    if (account) {
      parts.push(`acct=${account}`);
      matchedOn.push('accountNumber');
    }

    // Reference alone is not enough - an OCR misread of a short reference
    // could collide with a genuinely different document.
    if (matchedOn.length < 2) {
      return null;
    }

    return { key: sha256(parts.join('|')), matchedOn };
  }

  /** Uppercased, punctuation stripped: OCR reads "INV-2026-01" and "INV 2026 01" from the same print. */
  private normaliseReference(value: string | undefined): string | null {
    if (!value) return null;
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length > 0 ? cleaned : null;
  }

  /** "12,500" / "12500" / "12500.00" all have to land on the same string. */
  private normaliseAmount(value: string | undefined): string | null {
    if (!value) return null;
    const parsed = parseFloat(value.replace(/[^0-9.\-]/g, ''));
    return isNaN(parsed) ? null : parsed.toFixed(2);
  }

  /** Canonical YYYY-MM-DD, so DD/MM/YYYY and ISO forms of one date agree. */
  private normaliseDate(value: string | undefined): string | null {
    if (!value) return null;

    const iso = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.exec(value.trim());
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    }

    const dmy = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(value.trim());
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }

    return null;
  }
}
