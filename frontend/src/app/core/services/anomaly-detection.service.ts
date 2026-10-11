import { Injectable } from '@angular/core';

export interface AnomalyIssue {
  id: string;
  type: 'document' | 'data' | 'financial' | 'sanction';
  severity: 'info' | 'warning' | 'critical';
  field: string;
  message: string;
  value?: any;
  suggestion?: string;
}

export interface AnomalyReport {
  documentId: string;
  timestamp: Date;
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: AnomalyIssue[];
  overallStatus: 'PASS' | 'WARNING' | 'FAILED';
}

@Injectable({
  providedIn: 'root'
})
export class AnomalyDetectionService {

  // No sanctions logic lives in this service any more. Both checks now call
  // the examination service, which uses real sources instead of hardcoded
  // arrays:
  //   country -> ComplianceService.checkCountry()  (OFAC country programs)
  //   names   -> ComplianceService.checkEntity()   (OpenSanctions, scored
  //                                                 matching, incl. PEP)
  // Both are wired in document-reader.component.ts.

  analyzeExtraction(extraction: any): AnomalyReport {
    const issues: AnomalyIssue[] = [];
    const documentId = extraction.documentId || `DOC-${Date.now()}`;

    // Run all 4 detection types
    issues.push(...this.detectDocumentAnomalies(extraction));
    issues.push(...this.detectDataAnomalies(extraction));
    issues.push(...this.detectFinancialAnomalies(extraction));
    issues.push(...this.detectSanctionAnomalies(extraction));

    // Calculate stats
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    // Determine overall status
    let overallStatus: 'PASS' | 'WARNING' | 'FAILED' = 'PASS';
    if (criticalCount > 0) overallStatus = 'FAILED';
    else if (warningCount > 0) overallStatus = 'WARNING';

    return {
      documentId,
      timestamp: new Date(),
      totalIssues: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      issues,
      overallStatus
    };
  }

  // TYPE 1: DOCUMENT ANOMALIES (Missing/Unusual Fields)
  //
  // Required fields depend on the document type. An LC has an `lcNumber`,
  // not an `accountNumber`; a Bill of Lading has a `blNumber`, not a
  // `date`. Requiring a generic set on every doc type used to fail every
  // LC/BOL with three cosmetic "critical" issues.
  private detectDocumentAnomalies(extraction: any): AnomalyIssue[] {
    const issues: AnomalyIssue[] = [];
    const docType = (extraction.documentType || '').toUpperCase();

    // Fields that satisfy a "document identifier" requirement, across
    // all supported document types. Any one being present is enough.
    const idAliases = [
      'documentId', 'statementId', 'lcNumber', 'blNumber',
      'invoiceNumber', 'poNumber', 'receiptNumber', 'documentNumber'
    ];
    const hasDocId = idAliases.some(k => extraction[k]);

    // Fields that satisfy a "date" requirement.
    const dateAliases = ['date', 'issueDate', 'dateOfIssue', 'invoiceDate', 'receiptDate'];
    const hasDate = dateAliases.some(k => extraction[k]);

    // `accountNumber` is only meaningful on bank statements. Everything
    // else uses party/beneficiary/applicant instead.
    const needsAccountNumber = docType === 'BANK_STATEMENT';

    // `amount` covers LC amount / invoice amount / statement amount.
    const amountAliases = ['amount', 'lcAmount', 'invoiceAmount', 'totalAmount'];
    const hasAmount = amountAliases.some(k => extraction[k]);

    if (needsAccountNumber && !extraction.accountNumber) {
      issues.push({
        id: `doc_accountNumber_${Date.now()}`,
        type: 'document',
        severity: 'critical',
        field: 'accountNumber',
        message: 'Required field "accountNumber" is missing or empty',
        suggestion: 'Ensure accountNumber is extracted from the document'
      });
    }

    if (!hasDate) {
      issues.push({
        id: `doc_date_${Date.now()}`,
        type: 'document',
        severity: 'critical',
        field: 'date',
        message: 'No document date found (checked: date, issueDate, dateOfIssue, invoiceDate, receiptDate)',
        suggestion: 'Ensure a date field is extracted'
      });
    }

    if (!hasAmount) {
      issues.push({
        id: `doc_amount_${Date.now()}`,
        type: 'document',
        severity: 'warning',
        field: 'amount',
        message: 'No amount found on the document',
        suggestion: 'Verify the document has a monetary amount'
      });
    }

    if (!hasDocId) {
      issues.push({
        id: `doc_documentId_${Date.now()}`,
        type: 'document',
        severity: 'critical',
        field: 'documentId',
        message: 'No document identifier found (checked: documentId, lcNumber, blNumber, invoiceNumber, poNumber, receiptNumber, documentNumber, statementId)',
        suggestion: 'Ensure the document identifier is extracted'
      });
    }

    // Check for duplicate fields
    const allFields = Object.keys(extraction);
    if (allFields.length < 4) {
      issues.push({
        id: `doc_minimal_${Date.now()}`,
        type: 'document',
        severity: 'warning',
        field: 'fields',
        message: `Document has fewer than expected fields (${allFields.length} found, 4+ expected)`,
        suggestion: 'Document may be incomplete or improperly scanned'
      });
    }

    return issues;
  }

  /** Local midnight today, for comparing against a document's calendar date. */
  private today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Parses the two formats the format check above accepts, as LOCAL dates.
   * Deliberately not `new Date(string)`: that reads "12/09/2026" as
   * December 9th (US month-first), silently turning a valid DD/MM/YYYY
   * document date into a different month.
   */
  private parseDocumentDate(value: string): Date | null {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }

    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    if (dmy) {
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    }

    return null;
  }

  // TYPE 2: DATA ANOMALIES (Wrong Formats)
  private detectDataAnomalies(extraction: any): AnomalyIssue[] {
    const issues: AnomalyIssue[] = [];

    // Date format validation (YYYY-MM-DD or DD/MM/YYYY)
    if (extraction.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(extraction.date)) {
        issues.push({
          id: `data_date_${Date.now()}`,
          type: 'data',
          severity: 'warning',
          field: 'date',
          value: extraction.date,
          message: `Date format invalid: "${extraction.date}"`,
          suggestion: 'Use YYYY-MM-DD or DD/MM/YYYY format'
        });
      }

      // Compares calendar days, not instants. `new Date("2026-09-12")`
      // parses as midnight UTC, so east of Greenwich today's own date reads
      // as "in the future" for the first few hours of every local day.
      const docDate = this.parseDocumentDate(extraction.date);
      if (docDate && docDate > this.today()) {
        issues.push({
          id: `data_future_date_${Date.now()}`,
          type: 'data',
          severity: 'critical',
          field: 'date',
          value: extraction.date,
          message: 'Document date is in the future',
          suggestion: 'Verify the document date is correct'
        });
      }
    }

    // Account number format (10-16 digits)
    if (extraction.accountNumber) {
      const accountRegex = /^\d{10,16}$/;
      if (!accountRegex.test(extraction.accountNumber.toString())) {
        issues.push({
          id: `data_account_${Date.now()}`,
          type: 'data',
          severity: 'warning',
          field: 'accountNumber',
          value: extraction.accountNumber,
          message: `Account number format invalid (should be 10-16 digits)`,
          suggestion: 'Verify account number is correctly extracted'
        });
      }
    }

    // Amount validation (should be number)
    if (extraction.amount) {
      const amount = parseFloat(extraction.amount);
      if (isNaN(amount)) {
        issues.push({
          id: `data_amount_${Date.now()}`,
          type: 'data',
          severity: 'critical',
          field: 'amount',
          value: extraction.amount,
          message: 'Amount is not a valid number',
          suggestion: 'Ensure amount is numeric (e.g., 10000.50)'
        });
      }
    }

    return issues;
  }

  // TYPE 3: FINANCIAL ANOMALIES (Unusual Amounts/Patterns)
  private detectFinancialAnomalies(extraction: any): AnomalyIssue[] {
    const issues: AnomalyIssue[] = [];

    if (extraction.amount) {
      const amount = parseFloat(extraction.amount);

      // Negative amount
      if (amount < 0) {
        issues.push({
          id: `fin_negative_${Date.now()}`,
          type: 'financial',
          severity: 'critical',
          field: 'amount',
          value: amount,
          message: 'Amount is negative',
          suggestion: 'Verify this is a legitimate debit or return transaction'
        });
      }

      // Unusually high amount (>1 million)
      if (amount > 1000000) {
        issues.push({
          id: `fin_high_amount_${Date.now()}`,
          type: 'financial',
          severity: 'warning',
          field: 'amount',
          value: amount,
          message: `Unusually high amount: $${amount.toLocaleString()}`,
          suggestion: 'Verify large transaction is authorized and legitimate'
        });
      }

      // Zero amount
      if (amount === 0) {
        issues.push({
          id: `fin_zero_${Date.now()}`,
          type: 'financial',
          severity: 'warning',
          field: 'amount',
          value: amount,
          message: 'Amount is zero',
          suggestion: 'Unusual for financial transactions; verify accuracy'
        });
      }

      // Very small amount (suspicious for payment)
      if (amount > 0 && amount < 0.01) {
        issues.push({
          id: `fin_small_${Date.now()}`,
          type: 'financial',
          severity: 'info',
          field: 'amount',
          value: amount,
          message: 'Very small amount detected',
          suggestion: 'Verify this is intentional (e.g., test transaction)'
        });
      }
    }

    return issues;
  }

  /**
   * Policy checks that need no external data.
   *
   * Name and country screening deliberately do NOT happen here any more —
   * both call the examination service, which uses real sources. The previous
   * versions were hardcoded arrays with substring matching, which produced
   * false positives ("Miranda Shipping" matching on "iran") and could never
   * have caught a genuine variant spelling.
   */
  private detectSanctionAnomalies(extraction: any): AnomalyIssue[] {
    const issues: AnomalyIssue[] = [];

    // Transaction limit check (trade finance typical limit: $5M)
    if (extraction.amount) {
      const amount = parseFloat(extraction.amount);
      const transactionLimit = 5000000;

      if (amount > transactionLimit) {
        issues.push({
          id: `sanction_limit_${Date.now()}`,
          type: 'sanction',
          severity: 'warning',
          field: 'amount',
          value: amount,
          message: `Transaction exceeds compliance limit ($${transactionLimit.toLocaleString()})`,
          suggestion: 'Requires approval from compliance officer'
        });
      }
    }

    return issues;
  }

  /** Plain-text rendering of a report, for logs and exports. */
  formatReportForDisplay(report: AnomalyReport): string {
    let output = `\nVALIDATION REPORT\n`;
    output += `Document: ${report.documentId}\n`;
    output += `Status: ${report.overallStatus}\n`;
    output += `Issues: ${report.criticalCount} critical, ${report.warningCount} warning, ${report.infoCount} info\n\n`;

    if (report.issues.length === 0) {
      output += 'No issues found.\n';
    } else {
      report.issues.forEach((issue, idx) => {
        output += `${idx + 1}. [${issue.severity}] ${issue.type} / ${issue.field}\n`;
        output += `   ${issue.message}\n`;
        if (issue.suggestion) {
          output += `   ${issue.suggestion}\n\n`;
        }
      });
    }

    return output;
  }
}
