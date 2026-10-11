import { Injectable } from '@angular/core';

export interface ExtractedField {
  fieldName: string;
  value: string;
  confidence: number;
}

export interface FieldExtractionResult {
  fields: ExtractedField[];
  documentType: string;
  overallConfidence: number;
}

/**
 * Field captions that can end up stuck on the end of a value.
 *
 * Most patterns below keep newlines out of their value, so a value cannot run
 * past the end of its line into the next caption. That defence disappears when
 * OCR flattens a form onto one line. Add a caption here by adding a line.
 *
 * A single space means "any amount of whitespace", because OCR spacing varies.
 */
const FIELD_LABELS = [
  'port of (?:loading|discharge)',
  'hs code',
  'hsn code',
  'tariff code',
  'unit price',
  'description of goods',
  'vessel(?: name)?',
  'gross weight',
  'net weight',
  'notify party',
  'shipper',
  'consignee',
  'account (?:holder|number)',
  'statement id',
  'final destination',
  'incoterm',
  'price term',
  'trade term',
  'applicable rules',
  'form of (?:documentary )?credit',
  'latest (?:date of )?shipment(?: date)?',
  'expiry date',
  'issue date',
  'issuing bank',
  'advising bank',
  'reimbursing bank',
  'beneficiary',
  'applicant',
  'country of (?:origin|import|export)',
  'period for presentation',
  'confirmation instructions?',
];

/**
 * Matches a caption only at the END of a value. A value finishing with a whole
 * caption has swallowed the next field's; a real port like "PORT KLANG" has
 * not. Cutting at the first caption found anywhere would damage real values.
 */
const TRAILING_LABEL = new RegExp(
  `\\s+(?:${FIELD_LABELS.map(label => label.replace(/ /g, '\\s*')).join('|')})\\s*$`,
  'i'
);

@Injectable({
  providedIn: 'root'
})
export class FieldExtractionService {

  private patterns = {
    // --- Generic / multi-document fields ---
    accountNumber: /account\s*(?:number|no|#)?[:\s]+(\d{8,20})/i,
    date: /date[:\s]+(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    // Leading `-?` matters: without it, "Amount: -2500.00" fails to match
    // at all (the digit class doesn't accept the sign), so a negative
    // amount silently disappears as an unextracted field instead of
    // reaching the negative-amount financial-anomaly check downstream.
    // Require at least 2 digits so a lone `Amount 1` (field number caption
    // on a form) doesn't win over the real LC amount below.
    amount: /(?:amount|balance|total)[:\s]+\$?(-?[\d,]{2,}\.?\d{0,2})/i,
    // The separator is a literal ":" for the same reason as documentId
    // below: without it, "statement" alone (as in the "BANK STATEMENT"
    // heading, which precedes the real "Statement ID:" line on every bank
    // statement) satisfies "statement" + optional id/no/# + whitespace,
    // and captures the first word of the next line instead of the actual
    // statement ID.
    statementId: /statement\s*(?:id|no|#)?\s*:\s*([\w-]+)/i,
    // anomaly-detection.service.ts has always required this field but no
    // pattern ever extracted it - meaning "documentId is missing" fired on
    // every single document regardless of content, a dead validation rule.
    // Matches whatever identifier label the document actually uses -
    // invoices/BOLs/LCs each use different wording for the same concept.
    //
    // The separator is a literal ":" (not just any whitespace, unlike most
    // patterns above) because "reference" and "document id" are ordinary
    // English words as well as label prefixes - "Reference note: see
    // below" was matching as documentId="note" before this required a
    // colon. A labelled field on a real document is always followed by a
    // colon; prose almost never is.
    documentId: /(?:invoice\s*(?:no|number|#)?|document\s*id|doc\s*(?:no|id|#)?|reference\s*(?:no|number|#)?|b\/?l\s*no|bill\s*of\s*lading\s*no)\s*:\s*([\w-]+)/i,
    // The trailing [\s.,;:]* matters more than it looks: OCR regularly
    // reads a stray full stop at the end of a line that has none. Without
    // it the value had to sit flush against the line end, so one speck of
    // punctuation made the whole field fail to extract rather than
    // extract slightly wrong - and a field that never extracts silently
    // skips the check that depends on it.
    accountHolder: /(?:account\s*holder|name|customer)[:\s]+([A-Za-z\s]+?)[\s.,;:]*(?:\n|$)/i,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    phoneNumber: /(?:phone|tel|contact)[:\s]+([\d\-\+\(\)\s]{10,20})/i,
    // Without this, the sanctions country check has nothing to check —
    // extraction.country was always undefined and the check never fired.
    country: /(?:country\s*(?:of\s*(?:origin|import|export))?|jurisdiction)[:\s]+([A-Za-z\s]+?)[\s.,;:]*(?:\n|$)/i,
    // Same reasoning for the HS code pricing check - trade documents (LCs,
    // commercial invoices) label goods with an HS/HSN/tariff code and a
    // per-unit price, e.g. "HS Code: 6109.10" and "Unit Price: $5.00".
    hsCode: /(?:hs\s*code|hsn\s*code|tariff\s*code)[:\s]+(\d{4}\.?\d{2,4})/i,
    unitPrice: /unit\s*price[:\s]+\$?([\d,]+\.?\d{0,2})/i,
    // The SWIFT tag is skipped explicitly. An earlier `[^A-Za-z]+` was meant
    // to do it but could not: the "E" in "/ :44E:" is a letter, so the class
    // stopped dead there and the labelled occurrence never matched at all.
    // Extraction then fell through to the OCR key block at the foot of the
    // page, which repeats the same data without the ", UAE" separator - so
    // the port came back as "JEBEL ALI PORT UAE" on one layout and
    // "JEBEL ALI PORT" on another, a false conflict between two documents
    // that actually agree.
    //
    // The value class is [A-Za-z \t\-], deliberately NOT \s: \s matches a
    // newline, so on a document that puts each field on its own line the
    // match ran past the end of the line and swallowed the next label
    // ("CNSHA\nPort of Discharge"). It still stops at the comma before a
    // country suffix (", UAE").
    portOfLoading: /port\s*of\s*loading[ \t]*(?:\/[ \t]*:\d{2}[A-Z]?:)?[ \t]*:?[ \t]*([A-Za-z][A-Za-z \t\-]*[A-Za-z])/i,
    portOfDischarge: /port\s*of\s*discharge[ \t]*(?:\/[ \t]*:\d{2}[A-Z]?:)?[ \t]*:?[ \t]*([A-Za-z][A-Za-z \t\-]*[A-Za-z])/i,
    // IMO numbers are always exactly 7 digits and are how the vessel
    // tracking API identifies a ship - "IMO 9247431", "IMO No: 9247431".
    vesselImo: /imo\s*(?:no|number|#)?[:\s]+(\d{7})\b/i,

    // --- Import LC / SWIFT MT700 specific fields ---
    // LC Number (:20:). Three layouts across the test PDFs:
    //   MT700:       "LC_NUMBER=ILC202609170001"  (OCR key block at bottom)
    //   Structured:  "LC Number / :20: ILC202609170001"
    //   Simple:      "LC Number IMP-LC-2026-000123"
    // (?:[^:]*:)* skips through "/ :20:" style SWIFT tags before the value.
    lcNumber: /(?:lc_number[=:\s]+|lc\s*(?:number|no|#)\s*(?:\/\s*:[^:]+:)?\s*|:20:\s*(?:documentary\s*credit\s*number\s*)?)([A-Z0-9][A-Z0-9\-\/]{5,})/i,
    // :31C: Date of Issue. Uses [^\n]*? to skip variable label/tag text
    // before the actual date value (YYMMDD compact or DD-MON-YYYY).
    issueDate: /(?:date\s*of\s*issue|issue_date[=:]|:31c:)[^\n]*?(\d{6}|\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4})/i,
    // :31D: Date and Place of Expiry. Same non-greedy approach.
    expiryDate: /(?:expiry_date[=:]|expiry\s*date[^\n]*?|date\s*(?:and\s*place\s*)?of\s*expiry[^\n]*?|:31d:[^\n]*?)(\d{6}|\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i,
    // :32B: Currency Code — standalone 3-letter ISO code
    currency: /(?:currency\s*(?:code)?[^A-Z]*|:32b:[^A-Z]*)(USD|EUR|GBP|JPY|AED|PKR|CNY|CHF|CAD|AUD)\b/i,
    // :32B: Amount — numeric part (currency prefix captured separately above)
    // `:32B:` in an MT700 is followed by up to a dozen tokens ("Currency
    // Code, Amount") before the currency+amount. Old pattern's
    // `[^A-Z\d]*` gave up at the first letter, so USD125000,00 never
    // matched. Also accept `,00` (European decimal comma) for the same
    // reason. Requires min 3 digits to reject stray "1"s.
    lcAmount: /(?:lc\s*amount|credit\s*amount|lc\s*value|amount_=[^:]*:|:32b:[^:\d]{0,80}[A-Z]{3}\s*)([\d,]{3,}(?:[\.,]\d{0,2})?)/i,
    // :50: Applicant — captures full name (3+ chars), stopping at address/
    // account metadata that follows on a new line. Non-greedy `+?` combined
    // with a stop char alternation that includes `\n` used to end at the
    // very first newline — extracting just "S" when applicant name started
    // on its own line. Now requires minimum 3 chars and stops only at a
    // newline followed by a known metadata keyword.
    // OCR'd MT700 text often has no real newlines (single-line dump), so
    // relying only on `\n` fails to bound the match. Terminators here:
    //   `A/C <alnum>` — account-number prefix that always follows a name
    //   `:XX?:` — next SWIFT tag boundary (:59:, :51A:, :53A:, etc.)
    //   real newline followed by known metadata keywords
    // Non-greedy `+?` picks the shortest valid name before any terminator.
    // Negative lookahead `(?!\s*bank)` on the word "Applicant" so :51A:
    // Applicant Bank SCBLPKKX doesn't hijack this — that's the Applicant
    // Bank field, not the Applicant.
    //
    // `(?:applicant\s*)?` after the tag matters when the tag comes FIRST:
    // ":50:   Applicant  ABC TRADING" used to match on the tag and then
    // capture the human-readable label as part of the name, giving
    // "Applicant  ABC TRADING". The same layout writes the label before the
    // tag on other documents, so both orders have to be tolerated.
    //
    // The `\s{2,}` terminators mirror the `\n` ones because OCR'd MT700 text
    // often arrives as a single line with runs of spaces where the original
    // had line breaks - without them the name ran on into the address.
    applicant: /(?::50:|applicant(?!\s*bank)(?:\s*\/\s*:50:)?)\s*:?\s*(?:applicant\s*)?\s+([A-Za-z][A-Za-z0-9\s\(\)\.\,\-\/&]{2,100}?)(?=\s+A\/C\s+[A-Z0-9]|\s*:[0-9]{2}[A-Z]?:|\s{2,}(?:Registered|Address|Account|NTN|Plot|Swift|Ref|Reg\.?|Beneficiary)|\n\s*(?:Registered|Address|Account|NTN|Plot|Swift|Ref|Reg\.?|Beneficiary)|\n\s*\n|$)/i,
    // :59: Beneficiary — same terminators, same label-after-tag handling
    beneficiary: /(?:beneficiary(?:\s*\/\s*:59:)?|:59:)\s*:?\s*(?:beneficiary\s*)?\s+([A-Za-z][A-Za-z0-9\s\(\)\.\,\-\/&]{2,100}?)(?=\s+A\/C\s+[A-Z0-9]|\s*:[0-9]{2}[A-Z]?:|\s{2,}(?:Address|Warehouse|Account|Bank|SWIFT)|\n\s*(?:Address|Warehouse|Account|Bank|SWIFT)|\n\s*\n|$)/i,
    // :42A: Drawee / Issuing Bank
    issuingBank: /(?:issuing\s*bank|drawee(?:\s*\/\s*:42a:)?|:42a:)[^A-Za-z]+([A-Za-z][A-Za-z\s\(\)\.\,\-]+?)(?:\n|,\s*[A-Z]{2}|SWIFT|$)/i,
    // :57A: Advising Bank
    advisingBank: /(?:advising\s*bank(?:\s*\/\s*:57a:)?|:57a:|advise\s*through\s*bank)[^A-Za-z]+([A-Za-z][A-Za-z\s\(\)\.\,\-]+?)(?:\n|,\s*[A-Z]{2}|SWIFT|$)/i,
    // :53A: Reimbursing Bank
    reimbursingBank: /(?:reimbursing\s*bank(?:\s*\/\s*:53a:)?|:53a:)[^A-Za-z]+([A-Za-z][A-Za-z\s\(\)\.\,\-]+?)(?:\n|,\s*[A-Z]{2}|SWIFT|$)/i,
    // :42C: Drafts At / Payment Terms
    paymentTerms: /(?:payment_term[=:]|drafts?\s*at|payment\s*terms?)[^A-Za-z]+([A-Za-z][A-Za-z\s]+?)[\s]*(?:\n|$)/i,
    // :43P: Partial Shipments. Value is always one of the SWIFT-standard
    // allow/prohibit words; skip past the (repeated) label if the OCR
    // put it between the tag and the value.
    partialShipments: /(?::43p:|partial_shipment[=:]|partial\s*shipments?)[^A-Za-z]*(?:partial\s*shipments?\s*)?(ALLOWED|NOT\s*ALLOWED|PERMITTED|NOT\s*PERMITTED|PROHIBITED|CONDITIONAL)/i,
    // :43T: Transshipment — same pattern
    transshipment: /(?::43t:|transshipment)[^A-Za-z]*(?:transshipment\s*)?(ALLOWED|NOT\s*ALLOWED|PERMITTED|NOT\s*PERMITTED|PROHIBITED|CONDITIONAL)/i,
    // :44C: Latest Date of Shipment
    latestShipmentDate: /(?:latest_shipment_date[=:]|latest\s*(?:date\s*of\s*)?shipment(?:\s*date)?[^\n]*?|:44c:[^\n]*?)(\d{6}|\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}\s+\d{4})/i,
    // :44B: Final Destination
    finalDestination: /(?:final\s*destination(?:\s*\/\s*:44b:)?|:44b:|place\s*of\s*final\s*destination)[^A-Za-z]+([A-Za-z][A-Za-z\s\,]+?)[\s]*(?:\n|$)/i,
    // :40E: Applicable Rules (UCP 600 etc.). `[^\n]*` used to swallow
    // the rest of the line — for OCR'd text with no real newlines that
    // meant the whole rest of the document ended up here, bleeding
    // into every downstream field on the display. Cap at short trailing
    // qualifier (LATEST VERSION, /...) and stop at any next SWIFT tag.
    applicableRules: /(?:applicable\s*rules(?:\s*\/\s*:40e:)?|:40e:)[^A-Za-z]+(UCP\s*\d+(?:\s*(?:LATEST\s+VERSION|\/[A-Z\s]+))?)/i,
    // :40A: Form of Documentary Credit. The optional label repeat handles the
    // tag-first layout ":40A:   Form of Documentary Credit   IRREVOCABLE",
    // which previously matched on the tag and captured the label, so every
    // such document reported its form of credit as "Form".
    formOfCredit: /(?:form\s*of\s*(?:documentary\s*)?credit(?:\s*\/\s*:40a:)?|:40a:)[^A-Za-z]*(?:form\s*of\s*(?:documentary\s*)?credit\s*)?[^A-Za-z]*([A-Za-z]+)/i,
    // SWIFT BIC code (6–11 uppercase alphanumeric)
    swiftBic: /(?:swift\s*(?:\/\s*bic|code|:)?|bic)[:\s\/]+([A-Z]{6}[A-Z0-9]{0,5})\b/i,
    // Incoterm e.g. "CIF KARACHI PORT" — 3-letter code followed by place
    incoterm: /(?:incoterm|price\s*term|trade\s*term)[^A-Za-z]+([A-Z]{3}\s+[A-Za-z][A-Za-z\s\,\.]+?)[\s]*(?:\n|$)/i,
    // :39A: Tolerance (e.g. "05/05" or "+/- 5 percent")
    tolerance: /(?:tolerance(?:\s*\/\s*:39a:)?|:39a:)[^A-Za-z0-9%]+(\d+\/\d+|\+\/-\s*\d+\s*percent)/i,
    // :48: Period for Presentation
    presentationPeriod: /(?:period\s*for\s*presentation|presentation\s*period|:48:)[^A-Za-z0-9]+(\d+\s*(?:calendar\s*)?days?)/i,
    // :49: Confirmation Instructions
    // :49: Confirmation Instructions. The optional label repeat handles the
    // tag-first layout ":49:   Confirmation Instructions   WITHOUT", which
    // otherwise matched on the tag and captured the label, so those documents
    // reported their confirmation instruction as "Confirmation". Same fault,
    // and same fix, as formOfCredit above.
    confirmationInstructions: /(?:confirmation\s*instructions?(?:\s*\/\s*:49:)?|:49:)[^A-Za-z]*(?:confirmation\s*instructions?\s*)?[^A-Za-z]*([A-Za-z]+)/i,
    // Application / Applicant Reference (bank internal reference number)
    // The captured value must contain a digit. "APPLICATION REFERENCE" is used
    // as a section heading as well as a field label ("A. DOCUMENT CONTROL /
    // APPLICATION REFERENCE"), and under the heading the next word is the
    // start of the following caption - so this captured "Document" as the
    // reference. Every real bank reference carries digits; a caption does not.
    applicationReference: /(?:application\s*reference|applicant\s*reference)[:\s]+([A-Z0-9][A-Z0-9\-]*\d[A-Z0-9\-]*)/i,
  };

  /** Drops a next-field caption that a flattened line left on the value. */
  private stripTrailingLabel(value: string): string {
    // Only ever shortens, and the leading \s+ means it cannot empty a value
    // whose whole content happens to read as a label.
    return value.replace(TRAILING_LABEL, '').trim();
  }

  extractFields(text: string): FieldExtractionResult {
    const fields: ExtractedField[] = [];

    Object.entries(this.patterns).forEach(([fieldName, pattern]) => {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = this.stripTrailingLabel(match[1].trim());
        if (!value) return;
        fields.push({
          fieldName,
          value,
          confidence: this.calculateConfidence(value, fieldName)
        });
      }
    });

    const documentType = this.classifyDocument(text);
    const overallConfidence = fields.length > 0
      ? fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
      : 0;

    return { fields, documentType, overallConfidence };
  }

  private calculateConfidence(value: string, fieldName: string): number {
    let confidence = 0.7;

    switch (fieldName) {
      case 'accountNumber':
        confidence = /^\d{10,16}$/.test(value) ? 0.95 : 0.6;
        break;
      case 'date':
        confidence = /^\d{4}-\d{2}-\d{2}$/.test(value) ? 0.95 : 0.75;
        break;
      case 'amount':
        confidence = /^[\d,]+\.\d{2}$/.test(value) ? 0.9 : 0.65;
        break;
      case 'email':
        confidence = value.includes('@') && value.includes('.') ? 0.9 : 0.5;
        break;
      case 'hsCode':
        confidence = /^\d{4}\.\d{2,4}$/.test(value) ? 0.95 : 0.7;
        break;
      case 'unitPrice':
        confidence = /^[\d,]+\.\d{2}$/.test(value) ? 0.9 : 0.65;
        break;
      case 'portOfLoading':
      case 'portOfDischarge':
        // 5-letter UN/LOCODE gets high confidence; full name gets moderate
        confidence = /^[A-Za-z]{5}$/.test(value) ? 0.95 : 0.80;
        break;
      case 'vesselImo':
        confidence = /^\d{7}$/.test(value) ? 0.95 : 0.6;
        break;
      case 'documentId':
        confidence = /^[\w-]{4,}$/.test(value) ? 0.85 : 0.6;
        break;
      case 'lcNumber':
        confidence = /^[A-Z]{2,}[\w\-\/]{4,}$/.test(value) ? 0.95 : 0.75;
        break;
      case 'issueDate':
      case 'expiryDate':
      case 'latestShipmentDate':
        confidence = /^\d{6}$/.test(value) || /\d{1,2}[-\s][A-Za-z]{3}[-\s]\d{4}/.test(value) ? 0.90 : 0.70;
        break;
      case 'currency':
        confidence = /^[A-Z]{3}$/.test(value) ? 0.95 : 0.60;
        break;
      case 'lcAmount':
        confidence = /^[\d,]+\.?\d{0,2}$/.test(value) ? 0.90 : 0.65;
        break;
      case 'applicant':
      case 'beneficiary':
      case 'issuingBank':
      case 'advisingBank':
      case 'reimbursingBank':
        confidence = value.length >= 5 ? 0.85 : 0.55;
        break;
      case 'swiftBic':
        confidence = /^[A-Z]{6}[A-Z0-9]{0,5}$/.test(value) ? 0.95 : 0.60;
        break;
      case 'paymentTerms':
      case 'partialShipments':
      case 'transshipment':
      case 'formOfCredit':
      case 'confirmationInstructions':
        confidence = value.length >= 2 ? 0.85 : 0.50;
        break;
      case 'tolerance':
        confidence = /^\d+\/\d+$/.test(value) ? 0.90 : 0.65;
        break;
      case 'presentationPeriod':
        confidence = /^\d+\s*(?:calendar\s*)?days?$/i.test(value) ? 0.90 : 0.65;
        break;
      case 'incoterm':
        confidence = /^[A-Z]{3}\s+/i.test(value) ? 0.85 : 0.60;
        break;
      case 'applicableRules':
        confidence = /ucp\s*\d+/i.test(value) ? 0.92 : 0.65;
        break;
      case 'applicationReference':
        confidence = /^APP-/i.test(value) ? 0.90 : 0.70;
        break;
      case 'finalDestination':
        confidence = value.length >= 4 ? 0.80 : 0.50;
        break;
      default:
        confidence = value.length > 3 ? 0.75 : 0.5;
    }

    return confidence;
  }

  /**
   * `defining` keywords are the document naming its own type, and outweigh
   * any number of `supporting` ones. Scoring every keyword equally used to
   * mean a Bill of Lading that happened to say "Account Number" and
   * "Invoice No" tied at one point each with BANK_STATEMENT and INVOICE -
   * and a tie was settled by whichever sat first in this array, so real
   * BOLs classified as bank statements.
   *
   * "invoice" on its own is supporting, not defining: plenty of shipping
   * and credit documents reference an invoice number without being one.
   *
   * IMPORT_LETTER_OF_CREDIT is checked before LETTER_OF_CREDIT so the more
   * specific type wins when both sets of keywords are present in a document.
   */
  private static readonly DOCUMENT_TYPES = [
    {
      type: 'IMPORT_LETTER_OF_CREDIT',
      defining: [
        'import documentary credit',
        'import letter of credit',
        'documentary credit - import',
        'import_letter_of_credit',
        'swift mt700',
        'issue of a documentary credit'
      ],
      supporting: [
        'ucp 600',
        'beneficiary',
        'applicant',
        'irrevocable',
        'issuing bank',
        ':20:',
        ':32b:',
        ':44e:',
        ':44f:',
        'port of loading',
        'port of discharge',
        'latest date of shipment',
        'partial shipments',
        'transshipment',
        'documentary credit'
      ]
    },
    {
      type: 'BILL_OF_LADING',
      defining: ['bill of lading', 'b/l no', 'waybill'],
      supporting: ['shipper', 'consignee', 'port of loading', 'port of discharge', 'vessel']
    },
    {
      type: 'LETTER_OF_CREDIT',
      defining: ['letter of credit', 'documentary credit'],
      supporting: ['beneficiary', 'issuing bank', 'applicant', 'expiry date']
    },
    {
      type: 'PURCHASE_ORDER',
      defining: ['purchase order'],
      supporting: ['po number', 'vendor', 'delivery date']
    },
    {
      type: 'INVOICE',
      defining: ['commercial invoice', 'tax invoice', 'proforma invoice'],
      supporting: ['invoice', 'bill to', 'due date', 'payment terms']
    },
    {
      type: 'BANK_STATEMENT',
      defining: ['bank statement', 'statement of account', 'account statement'],
      supporting: ['statement', 'account', 'balance', 'transaction']
    },
    {
      type: 'RECEIPT',
      defining: ['receipt'],
      supporting: ['paid', 'thank you', 'transaction id']
    }
  ];

  private classifyDocument(text: string): string {
    const lowerText = text.toLowerCase();

    let bestMatch = { type: 'UNKNOWN', score: 0 };

    for (const { type, defining, supporting } of FieldExtractionService.DOCUMENT_TYPES) {
      const definingHits = defining.filter(kw => lowerText.includes(kw)).length;
      const supportingHits = supporting.filter(kw => lowerText.includes(kw)).length;
      const score = definingHits * 10 + supportingHits;

      if (score > bestMatch.score) {
        bestMatch = { type, score };
      }
    }

    return bestMatch.type;
  }
}
