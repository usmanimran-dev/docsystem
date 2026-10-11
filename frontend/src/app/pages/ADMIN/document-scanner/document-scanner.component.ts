import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';

import { OcrService, OcrResult } from '../../../core/services/ocr.service';
import { FieldExtractionService, FieldExtractionResult } from '../../../core/services/field-extraction.service';
import { DuplicateDetectionService, DuplicateCheckResult } from '../../../core/services/duplicate-detection.service';
import { AnomalyDetectionService, AnomalyReport, AnomalyIssue } from '../../../core/services/anomaly-detection.service';
import { ComplianceService, CountryCheckResult, EntityCheckResult, HsCodePriceCheckResult, HsCodeSanctionCheckResult, PortCheckResult, StoredCountry, StoredPort } from '../../../core/services/compliance.service';
import { AnalysisResponse, DocumentAnalysisService, SaveAnalysisRequest } from '../../../core/services/document-analysis.service';
import { VesselService, RouteDeviationResult, FlagStateResult, OwnershipScreeningResult } from '../../../core/services/vessel.service';
import { DocumentViewerService } from '../../../core/services/document-viewer.service';
import { logger } from '../../../core/logging/logger';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

interface ExtractedData {
  id: string;
  text: string;
  coordinates: { x1: number; y1: number; x2: number; y2: number };
  timestamp: Date;
}

type DocFileType = 'image' | 'pdf' | null;

/**
 * The extracted fields, flattened to name-to-value, as the checks read them.
 * The named ones are what the compliance and vessel checks look for; the index
 * signature covers every other field the extractor happens to find.
 */
interface ExtractedValues {
  documentType?: string;
  country?: string;
  hsCode?: string;
  unitPrice?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  vesselImo?: string;
  [fieldName: string]: string | undefined;
}

@Component({
  selector: 'app-document-reader',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatChipsModule,
    MatTabsModule
  ],
  templateUrl: './document-scanner.component.html',
  styleUrl: './document-scanner.component.scss'
})
export class DocumentScannerComponent implements OnInit, OnDestroy {
  documentCanvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  documentImage: HTMLImageElement | null = null;
  uploadedFile: File | null = null;

  /**
   * Bumped every time something decides to load a document — a fresh
   * upload (onFileSelected) or the background restore-on-init
   * (restoreLastAnalysis). Both go through the same async loadImage()
   * pipeline (FileReader -> Image.onload), and if a user uploads a new
   * file while the restore is still in flight, their callbacks used to
   * race: whichever one's canvas-creation happened to land last would win
   * the DOM element, but the OTHER one's already-fired onload had set
   * documentImage/pendingImage that never got (re)drawn - leaving the
   * canvas at its default blank 300x150. Each async callback below checks
   * its own captured token against the current value and abandons itself
   * if a newer load has since started, so only the most recently
   * requested document ever reaches the canvas.
   */
  private documentLoadSequence = 0;
  isSelecting = false;
  startX = 0;
  startY = 0;
  extractedDataList: ExtractedData[] = [];

  uploadedFileName = '';
  docWidth = 0;
  docHeight = 0;
  // Archived 2026-09-12 at the user's request. Code stays intact (same
  // pattern as showEntityScreening) - flip this back to true to restore
  // drag-to-select region extraction rather than rebuilding it.
  selectionMode = false;
  viewMode: 'normal' | 'preview' = 'normal';

  // Document loading / display
  documentFileType: DocFileType = null;
  isLoadingDocument = false;
  pdfSafeUrl: SafeResourceUrl | null = null;
  pdfObjectUrl: string | null = null;
  errorMessage = '';

  // Analysis state
  isProcessing = false;
  processingStep = '';

  // Persistence state - the saved record's id, so it can be reopened later
  savedAnalysisId: string | null = null;
  saveError = '';

  // Entity screening. Working end-to-end (see compliance.service.ts and
  // edms-examination-service's /compliance/check-entity), but hidden from
  // the UI for now - this was built to properly replace a broken
  // substring-matching check found in the old code, not because it was an
  // explicit requirement. The actual asked-for scope is country checking
  // only. Flip this to true to bring it back rather than re-adding the
  // template block from scratch.
  showEntityScreening = false;

  // Deliberately manual rather than part of the automatic pipeline: the
  // OpenSanctions trial tier allows 50 requests a month, so firing on every
  // upload would exhaust it in about two weeks and the check would then
  // fail silently exactly when someone relied on it.
  entityCheckResult: EntityCheckResult | null = null;
  isCheckingEntity = false;
  entityCheckError = '';

  // Results
  ocrResult: OcrResult | null = null;

  // The bank's own port and country lists, fetched at the start of each
  // scan so free-text LC values ("JEBEL ALI PORT UAE") can be matched to a
  // listed port / country. Empty if the examination service is down.
  private knownPorts: StoredPort[] = [];
  private listedCountries: StoredCountry[] = [];
  fieldExtractionResult: FieldExtractionResult | null = null;
  duplicateCheckResult: DuplicateCheckResult | null = null;
  anomalyReport: AnomalyReport | null = null;

  /**
   * Set when a PDF's embedded text was extracted via pdfjs. runFullAnalysis
   * uses this in place of running tesseract, since a text-based PDF (e.g. the
   * bank's LC form) has 100%-accurate text right in the file and OCR-ing
   * the rendered page would only add noise and time.
   */
  private preExtractedOcr: OcrResult | null = null;

  showAnalysisPanel = false;

  // SRT save-to-DMS state. Kept separate from savedAnalysisId (which tracks the
  // examination-service copy) so that a partial success — analysis saved but DMS
  // upload refused — is still visible instead of silently disappearing.
  isSavingToDms = false;
  dmsSaveError = '';
  dmsSaveResult = '';

  constructor(
    private ocrService: OcrService,
    private fieldExtractionService: FieldExtractionService,
    private duplicateDetectionService: DuplicateDetectionService,
    private anomalyDetectionService: AnomalyDetectionService,
    private complianceService: ComplianceService,
    private documentAnalysisService: DocumentAnalysisService,
    private vesselService: VesselService,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private auth: AuthService,
    private viewer: DocumentViewerService
  ) {}

  /** Which analysis to bring back after a reload. */
  private static readonly LAST_ANALYSIS_KEY = 'documentReader.lastAnalysisId';

  isRestoring = false;

  ngOnInit() {
    this.restoreLastAnalysis();
  }

  ngOnDestroy() {
    // Without this the PDF's blob stayed in memory for the rest of the
    // session every time the user navigated away from the reader.
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
  }

  /**
   * Brings back the last analysis and its document after a page reload.
   *
   * Both halves are needed: the analysis alone leaves the reader showing
   * findings for a document you cannot see, and this used to be the gap -
   * the record was saved server-side but the uploaded file only ever
   * existed in browser memory, so a reload showed nothing at all.
   *
   * Stays quiet on failure. A missing or deleted record is the normal
   * case for a first visit, not an error worth putting on screen.
   */
  private async restoreLastAnalysis(): Promise<void> {
    const lastId = localStorage.getItem(DocumentScannerComponent.LAST_ANALYSIS_KEY);
    if (!lastId) return;

    this.isRestoring = true;

    try {
      const saved = await firstValueFrom(this.documentAnalysisService.getById(lastId));
      const blob = await firstValueFrom(this.documentAnalysisService.downloadFile(lastId));

      this.applyRestoredAnalysis(saved);

      const file = new File([blob], saved.filename, { type: blob.type });
      this.uploadedFile = file;
      this.uploadedFileName = saved.filename;
      this.documentFileType = saved.fileType === 'pdf' ? 'pdf' : 'image';
      this.isLoadingDocument = true;

      if (this.documentFileType === 'pdf') {
        this.loadPdf(file);
      } else {
        this.loadImage(file, false);
      }

      this.showAnalysisPanel = true;
      this.savedAnalysisId = saved.id;
    } catch (err) {
      // Record or file gone (deleted, different machine, service down).
      // Drop the pointer so the next load starts clean instead of
      // retrying something that will not come back.
      localStorage.removeItem(DocumentScannerComponent.LAST_ANALYSIS_KEY);
      logger.debug('No previous analysis to restore.', err);
    } finally {
      this.isRestoring = false;
    }
  }

  private applyRestoredAnalysis(saved: AnalysisResponse): void {
    this.ocrResult = saved.ocrResult
      ? { text: saved.ocrResult.text, confidence: saved.ocrResult.confidence, words: [] }
      : null;

    this.fieldExtractionResult = saved.fieldExtraction
      ? {
          documentType: saved.fieldExtraction.documentType,
          overallConfidence: saved.fieldExtraction.overallConfidence,
          fields: saved.fieldExtraction.fields
        }
      : null;

    this.duplicateCheckResult = saved.duplicateCheck
      ? {
          isDuplicate: saved.duplicateCheck.duplicate,
          hash: saved.duplicateCheck.hash,
          existingDocumentId: saved.duplicateCheck.existingDocumentId ?? undefined,
          matchType: (saved.duplicateCheck.matchType as 'EXACT_FILE' | 'SAME_CONTENT') ?? undefined
        }
      : null;

    // Re-run the RULE-based checks on load (doc_/data_/fin_/sanction_limit_)
    // so fixes to those rules apply to old saved reports. Issues that came
    // from the backend checks (country, port, hs code, pricing, entity,
    // vessel) can't be recomputed here without network calls, so the stored
    // ones are kept as they were.
    if (this.fieldExtractionResult) {
      const fresh = this.anomalyDetectionService.analyzeExtraction(this.buildExtractionObject());
      const ruleBased = /^(doc_|data_|fin_|sanction_limit_)/;
      const keptFromBackend: AnomalyIssue[] = (saved.anomalyReport?.issues ?? [])
        .filter(i => !ruleBased.test(i.id))
        .map(i => ({
          id: i.id,
          type: i.type as AnomalyIssue['type'],
          severity: i.severity as AnomalyIssue['severity'],
          field: i.field,
          message: i.message,
          value: i.value,
          suggestion: i.suggestion
        }));
      const issues = [...fresh.issues, ...keptFromBackend];
      const criticalCount = issues.filter(i => i.severity === 'critical').length;
      const warningCount = issues.filter(i => i.severity === 'warning').length;
      this.anomalyReport = {
        ...fresh,
        issues,
        criticalCount,
        warningCount,
        infoCount: issues.filter(i => i.severity === 'info').length,
        totalIssues: issues.length,
        overallStatus: criticalCount > 0 ? 'FAILED' : warningCount > 0 ? 'WARNING' : 'PASS'
      };
    } else {
      this.anomalyReport = null;
    }
  }

  // The canvas lives inside an *ngIf, so it only exists once an image is
  // loaded — this setter wires it up the moment Angular creates it.
  @ViewChild('documentCanvas')
  set canvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (!ref || this.documentCanvas === ref.nativeElement) return;

    this.documentCanvas = ref.nativeElement;
    this.ctx = this.documentCanvas.getContext('2d')!;
    this.setupCanvasEvents();

    if (this.pendingImage) {
      this.renderImage(this.pendingImage);
      this.pendingImage = null;
    }
  }

  private pendingImage: HTMLImageElement | null = null;

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Invalidates any load still in flight - most importantly the
    // background restore-on-init (restoreLastAnalysis), which can still be
    // fetching/decoding its own document if the user uploads a fresh one
    // quickly after the page opens. Without this, the two raced: see
    // documentLoadSequence's comment.
    ++this.documentLoadSequence;

    this.uploadedFile = file;
    this.uploadedFileName = file.name;
    this.resetAnalysis();
    this.errorMessage = '';
    this.isLoadingDocument = true;
    this.documentImage = null;
    this.pdfSafeUrl = null;

    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    this.documentFileType = isPdf ? 'pdf' : 'image';

    if (isPdf) {
      this.loadPdf(file);
    } else {
      this.loadImage(file);
    }
  }

  private async loadPdf(file: File): Promise<void> {
    // Revoke here rather than only in onFileSelected: restoreLastAnalysis also
    // reaches this method, and used to replace the URL without freeing it.
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
    }
    // Native browser preview via object URL (same as the search-ref viewer).
    this.pdfObjectUrl = URL.createObjectURL(file);
    this.pdfSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfObjectUrl);
    const token = ++this.documentLoadSequence;

    try {
      // Lazy-import pdfjs so its ~1MB bundle only lands when a PDF is opened,
      // not on every route load. Worker src is a same-origin URL so no CDN.
      const pdfjs: any = await import('pdfjs-dist');
      // Copied to /pdfjs/ by angular.json assets - served same-origin, no CDN.
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

      const buf = await file.arrayBuffer();
      if (token !== this.documentLoadSequence) return;

      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      if (token !== this.documentLoadSequence) return;

      // Text-based PDFs (bank forms, LCs, invoices exported from Word) carry
      // exact text in the file itself — extract it directly and skip OCR.
      // Only fall back to raster-OCR when the PDF is a scan with no text.
      let embedded = '';
      const pagesToScan = Math.min(pdf.numPages, 10);
      for (let p = 1; p <= pagesToScan; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = (content.items as any[])
          .map(it => (it && typeof it.str === 'string' ? it.str : ''))
          .join(' ');
        if (pageText.trim()) embedded += pageText + '\n\n';
      }
      if (token !== this.documentLoadSequence) return;

      // Always render page 1 to a bitmap: needed so the analysis pipeline
      // (which requires documentImage) will run, and so a scanned PDF that
      // had no embedded text still has something for tesseract to read.
      const page1 = await pdf.getPage(1);
      const viewport = page1.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2D context unavailable');
      await page1.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      if (token !== this.documentLoadSequence) return;

      const trimmed = embedded.trim();
      if (trimmed.length > 50) {
        // confidence is stored 0-1 everywhere else (Tesseract's 0-100 is
        // normalised in ocr.service.ts). PDF embedded-text is exact, so 1.
        this.preExtractedOcr = { text: trimmed, confidence: 1, words: [] };
        logger.debug(`[loadPdf] Using embedded text (${trimmed.length} chars), skipping OCR`);
      } else {
        this.preExtractedOcr = null;
        logger.debug('[loadPdf] No embedded text; will OCR the rendered page');
      }

      const img = new Image();
      img.onload = async () => {
        if (token !== this.documentLoadSequence) return;
        this.documentImage = img;
        this.docWidth = img.width;
        this.docHeight = img.height;
        this.isLoadingDocument = false;
        // Canvas rendering onto the visible <canvas> only happens for image
        // uploads — PDFs keep using the iframe preview above the analysis.
        await this.runFullAnalysis();
      };
      img.onerror = () => {
        if (token !== this.documentLoadSequence) return;
        this.isLoadingDocument = false;
        this.errorMessage = 'Rendered page failed to load for OCR.';
      };
      img.src = canvas.toDataURL('image/png');
    } catch (err: any) {
      console.error('PDF load failed:', err);
      this.isLoadingDocument = false;
      this.errorMessage = 'Could not read this PDF: '
        + (err?.message || 'unknown error');
    }
  }

  /**
   * @param analyse false when restoring a saved analysis - the document is
   * being redrawn to accompany results that already exist, so re-running
   * OCR would spend the work again, re-flag the file as a duplicate of
   * itself, and save a second record for the same document.
   */
  private loadImage(file: File, analyse = true): void {
    const token = ++this.documentLoadSequence;
    const reader = new FileReader();

    reader.onload = (e) => {
      if (token !== this.documentLoadSequence) return; // superseded by a newer load
      const img = new Image();

      img.onload = async () => {
        if (token !== this.documentLoadSequence) return; // superseded while decoding
        this.documentImage = img;
        this.docWidth = img.width;
        this.docHeight = img.height;
        this.isLoadingDocument = false;

        // documentCanvas can be a STALE reference to an already-removed
        // element: the canvas lives inside *ngIf="...&& documentImage", so
        // setting documentImage briefly falsy anywhere (a fresh upload's
        // "= null" before this point, or clearAll()) destroys the old
        // canvas DOM node - but nothing ever cleared the class property
        // pointing at it. Without the DOM-attachment check, this branch
        // would silently draw onto that detached, invisible element while
        // the real (new) canvas the ViewChild setter creates right after
        // stays blank. Checked here rather than reset at every place that
        // nulls documentImage, so it stays correct even if a future call
        // site does that without knowing about this.
        if (this.documentCanvas && document.body.contains(this.documentCanvas)) {
          this.renderImage(img);
        } else {
          // Canvas not created yet (or was just destroyed) — the ViewChild
          // setter will draw it once Angular creates the new one.
          this.pendingImage = img;
        }

        logger.debug('Document loaded:', this.uploadedFileName);
        if (analyse) {
          await this.runFullAnalysis();
        }
      };

      img.onerror = () => {
        if (token !== this.documentLoadSequence) return;
        this.isLoadingDocument = false;
        this.errorMessage = 'Could not load this image. The file may be corrupted or an unsupported format.';
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      if (token !== this.documentLoadSequence) return;
      this.isLoadingDocument = false;
      this.errorMessage = 'Could not read the selected file.';
    };

    reader.readAsDataURL(file);
  }

  private renderImage(img: HTMLImageElement): void {
    this.documentCanvas.width = img.width;
    this.documentCanvas.height = img.height;
    this.ctx.drawImage(img, 0, 0);
  }

  openInNewTab(): void {
    if (this.pdfObjectUrl) {
      window.open(this.pdfObjectUrl, '_blank');
    } else if (this.documentImage) {
      window.open(this.documentImage.src, '_blank');
    }
  }

  /**
   * The whole pipeline for one document, in the order it happens. Each step
   * is a method below; read this to see the shape, drill in for the detail.
   */
  async runFullAnalysis(): Promise<void> {
    if (!this.uploadedFile || !this.documentImage) return;

    this.isProcessing = true;
    this.showAnalysisPanel = true;
    this.errorMessage = '';

    try {
      await this.findDuplicateFile();
      const text = await this.readDocumentText();

      this.processingStep = 'Extracting fields…';
      this.fieldExtractionResult = this.fieldExtractionService.extractFields(text);

      await this.findRescannedCopies();

      this.processingStep = 'Validating…';
      const fields = this.buildExtractionObject();
      this.anomalyReport = this.anomalyDetectionService.analyzeExtraction(fields);

      await this.loadComplianceLists();
      await this.runComplianceChecks(fields);
      await this.runVesselChecks(fields);

      this.processingStep = 'Saving…';
      await this.persistAnalysis();
      this.processingStep = 'Done';

    } catch (error: any) {
      console.error('Analysis failed:', error);
      this.processingStep = 'Failed';
      this.errorMessage = 'Could not analyse this document: '
        + (error?.message || 'unexpected error — see the browser console for details.');
    } finally {
      this.isProcessing = false;
    }
  }

  private async findDuplicateFile(): Promise<void> {
    this.processingStep = 'Checking for duplicates…';
    this.duplicateCheckResult = await this.checkDuplicateServerWide(this.uploadedFile!);

    if (this.duplicateCheckResult.isDuplicate) {
      console.warn('Duplicate document detected', this.duplicateCheckResult);
    }
  }

  /** Returns the document's text, and stores it on ocrResult for the report. */
  private async readDocumentText(): Promise<string> {
    // A text-based PDF already gave up its text in loadPdf, and that text is
    // exact. OCR-ing a rasterised copy of it would only add noise and time.
    if (this.preExtractedOcr) {
      this.processingStep = 'Reading text (embedded)…';
      this.ocrResult = this.preExtractedOcr;
      return this.ocrResult.text;
    }

    // The first run downloads the recogniser's worker and language data,
    // which is why this step can sit for several seconds.
    this.processingStep = 'Reading text…';
    this.ocrResult = await this.ocrService.extractText(this.documentImage!.src);
    return this.ocrResult.text;
  }

  /**
   * Runs even when the file is already an exact duplicate: the content key it
   * builds is what lets a LATER re-scan of this document be recognised.
   */
  private async findRescannedCopies(): Promise<void> {
    this.processingStep = 'Checking for re-scanned copies…';
    await this.checkDuplicateByContent();
  }

  /** Sanctions, pricing and export-control checks, all against the backend. */
  private async runComplianceChecks(fields: ExtractedValues): Promise<void> {
    if (fields.country) {
      this.processingStep = 'Checking sanctions…';
      await this.checkCountrySanctions(fields.country);
    } else {
      // An LC has no "Country:" line — its countries are only visible inside
      // the port text ("KARACHI PORT PAKISTAN").
      await this.checkCountriesFromPorts(fields);
    }

    // Needs both halves: a code with no price has nothing to compare against.
    if (fields.hsCode && fields.unitPrice) {
      this.processingStep = 'Checking pricing…';
      await this.checkHsCodePricing(fields.hsCode, fields.unitPrice);
    }

    // Separate signal from the price check: flags the trade itself as
    // restricted, whatever the price.
    if (fields.hsCode && fields.country) {
      this.processingStep = 'Checking HS code restrictions…';
      await this.checkHsCodeSanction(fields.hsCode, fields.country);
    }

    // Independent signals — a bill of lading may name either port, both or
    // neither, so each is checked on its own.
    if (fields.portOfLoading) {
      this.processingStep = 'Checking port of loading…';
      await this.checkPortSanctions(fields.portOfLoading, 'portOfLoading', 'Port of loading');
    }
    if (fields.portOfDischarge) {
      this.processingStep = 'Checking port of discharge…';
      await this.checkPortSanctions(fields.portOfDischarge, 'portOfDischarge', 'Port of discharge');
    }
  }

  /** Vessel checks. The route one costs money, so its guard is strict. */
  private async runVesselChecks(fields: ExtractedValues): Promise<void> {
    if (!fields.vesselImo) return;

    // Data Docked bills about one credit per call on a 20-credit trial, so
    // all three fields must be present — a route check missing half its input
    // spends the credit and concludes nothing.
    if (fields.portOfLoading && fields.portOfDischarge) {
      this.processingStep = 'Checking vessel route…';
      await this.checkRouteDeviation(fields.vesselImo, fields.portOfLoading, fields.portOfDischarge);
    }

    // These need only the IMO, so they run on any document naming a vessel.
    this.processingStep = 'Checking vessel flag state…';
    await this.checkVesselFlagState(fields.vesselImo);

    this.processingStep = 'Screening vessel ownership…';
    await this.checkVesselOwnership(fields.vesselImo);
  }

  /**
   * Server-wide duplicate check: hashes the file locally (no need to upload
   * it just to ask this question), then asks the backend whether ANY
   * previously saved analysis - from any browser or device - has the same
   * fileHash. Replaces the old browser-localStorage-only check, which could
   * never recognise a repeat uploaded from somewhere else.
   */
  private async checkDuplicateServerWide(file: File): Promise<DuplicateCheckResult> {
    const hash = await this.duplicateDetectionService.calculateFileHash(file);
    const matches = await firstValueFrom(this.documentAnalysisService.findByHash(hash));

    if (matches.length > 0) {
      return {
        isDuplicate: true,
        matchType: 'EXACT_FILE',
        hash,
        existingDocumentId: matches[0].id,
        uploadedAt: new Date(matches[0].analysedAt)
      };
    }

    return { isDuplicate: false, hash };
  }

  /**
   * Catches the same document re-scanned or re-exported: different bytes,
   * so the file hash misses it, but the same reference number and
   * corroborating fields.
   *
   * Does nothing when the extractor could not build a safe content key -
   * see DuplicateDetectionService.buildContentKey for why a weak key is
   * dropped rather than matched loosely.
   */
  private async checkDuplicateByContent(): Promise<void> {
    if (!this.duplicateCheckResult) return;

    const built = this.duplicateDetectionService.buildContentKey(this.buildExtractionObject());
    if (!built) return;

    this.duplicateCheckResult = { ...this.duplicateCheckResult, contentKey: built.key };

    // The key is now attached for saving either way. Only skip asking
    // whether it ALREADY exists elsewhere when this upload is already a
    // known exact-file duplicate - an exact match is the stronger finding,
    // and there is no reason to override it here.
    if (this.duplicateCheckResult.isDuplicate) return;

    const matches = await firstValueFrom(this.documentAnalysisService.findByContentKey(built.key));
    if (matches.length === 0) return;

    this.duplicateCheckResult = {
      ...this.duplicateCheckResult,
      isDuplicate: true,
      matchType: 'SAME_CONTENT',
      matchedOn: built.matchedOn,
      existingDocumentId: matches[0].id,
      uploadedAt: new Date(matches[0].analysedAt)
    };

    console.warn('Same document detected under a different file', this.duplicateCheckResult);
  }

  /** The name the entity screening would check, if the extractor found one. */
  get extractableName(): string | null {
    const field = this.fieldExtractionResult?.fields
      .find(f => f.fieldName === 'accountHolder');
    return field?.value?.trim() || null;
  }

  /**
   * Screens the extracted account holder against real watchlists.
   *
   * Triggered by the user, not automatically - see the note on
   * entityCheckResult for why.
   */
  async checkEntityName(schema: 'Person' | 'Company' = 'Company'): Promise<void> {
    const name = this.extractableName;
    if (!name) return;

    this.isCheckingEntity = true;
    this.entityCheckError = '';
    this.entityCheckResult = null;

    try {
      const result = await firstValueFrom(this.complianceService.checkEntity(name, schema));
      this.entityCheckResult = result;

      if (result.error) {
        this.entityCheckError = result.error;
      } else if (result.hasMatch) {
        this.mergeEntityMatchIntoReport(result);
      }
    } catch (err: any) {
      this.entityCheckError = err?.status === 0
        ? 'The examination service is not reachable — nothing was screened.'
        : `Screening failed (server returned ${err?.status ?? 'an error'}) — nothing was screened.`;
      console.error('Entity screening failed:', err);
    } finally {
      this.isCheckingEntity = false;
    }
  }

  /** Folds a confirmed watchlist hit into the validation report, same as the country check does. */
  private mergeEntityMatchIntoReport(result: EntityCheckResult): void {
    if (!this.anomalyReport) return;

    const top = result.candidates.find(c => c.isMatch);
    if (!top) return;

    const issue: AnomalyIssue = {
      id: `sanction_entity_${Date.now()}`,
      type: 'sanction',
      severity: 'critical',
      field: 'accountHolder',
      value: result.checked,
      message: `"${result.checked}" matches "${top.name}" on a watchlist `
        + `(${Math.round(top.score * 100)}% match)`,
      suggestion: 'Do not process until a compliance officer reviews this match. '
        + `Listed on: ${(top.datasets ?? []).slice(0, 3).join(', ')}`
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: 'FAILED'
    };
  }

  /**
   * Writes the finished analysis to edms-examination-service so it outlives
   * this browser session.
   *
   * A save failure is surfaced rather than swallowed - showing results that
   * were never stored, with no indication of that, is worse than showing an
   * error, because someone would reasonably assume the record exists.
   */
  private async persistAnalysis(): Promise<void> {
    this.saveError = '';

    const request: SaveAnalysisRequest = {
      filename: this.uploadedFileName,
      fileType: this.documentFileType ?? 'image',
      fileHash: this.duplicateCheckResult?.hash ?? '',
      contentKey: this.duplicateCheckResult?.contentKey ?? null,
      ocrResult: this.ocrResult
        ? { text: this.ocrResult.text, confidence: this.ocrResult.confidence }
        : null,
      fieldExtraction: this.fieldExtractionResult
        ? {
            documentType: this.fieldExtractionResult.documentType,
            overallConfidence: this.fieldExtractionResult.overallConfidence,
            fields: this.fieldExtractionResult.fields.map(f => ({
              fieldName: f.fieldName, value: f.value, confidence: f.confidence
            }))
          }
        : null,
      duplicateCheck: this.duplicateCheckResult
        ? {
            duplicate: this.duplicateCheckResult.isDuplicate,
            hash: this.duplicateCheckResult.hash,
            existingDocumentId: this.duplicateCheckResult.existingDocumentId ?? null,
            matchType: this.duplicateCheckResult.matchType ?? null
          }
        : null,
      anomalyReport: this.anomalyReport
        ? {
            totalIssues: this.anomalyReport.totalIssues,
            criticalCount: this.anomalyReport.criticalCount,
            warningCount: this.anomalyReport.warningCount,
            infoCount: this.anomalyReport.infoCount,
            overallStatus: this.anomalyReport.overallStatus,
            issues: this.anomalyReport.issues.map(i => ({
              id: i.id, type: i.type, severity: i.severity, field: i.field,
              message: i.message, value: i.value, suggestion: i.suggestion
            }))
          }
        : null,
      manualExtractions: this.extractedDataList.map(e => ({
        id: e.id,
        text: e.text,
        x1: Math.round(e.coordinates.x1),
        y1: Math.round(e.coordinates.y1),
        x2: Math.round(e.coordinates.x2),
        y2: Math.round(e.coordinates.y2),
        timestamp: e.timestamp.toISOString()
      }))
    };

    try {
      const saved = await firstValueFrom(this.documentAnalysisService.save(request));
      this.savedAnalysisId = saved.id;
      logger.debug('Analysis saved:', saved.id);

      // The file is stored separately and deliberately after the analysis:
      // a failure here costs the document preview on reload, not the
      // analysis itself, so it must not fail the save.
      if (this.uploadedFile) {
        try {
          await firstValueFrom(
            this.documentAnalysisService.uploadFile(saved.id, this.uploadedFile)
          );
          localStorage.setItem(DocumentScannerComponent.LAST_ANALYSIS_KEY, saved.id);
        } catch (fileErr) {
          console.warn('Analysis saved, but its file could not be stored:', fileErr);
        }
      }
    } catch (err: any) {
      this.savedAnalysisId = null;
      this.saveError = 'Analysis completed but could not be saved — '
        + (err?.status === 0
            ? 'the examination service is not reachable.'
            : `server returned ${err?.status ?? 'an error'}.`);
      console.error('Save failed:', err);
    }
  }

  /**
   * Calls edms-examination-service (localhost:8090, proxied through
   * /examine) and folds the result into the existing anomalyReport,
   * recomputing counts and overall status rather than just appending —
   * so the summary numbers stay correct even if this is the only issue
   * found.
   */
  private async checkCountrySanctions(country: string, context?: string): Promise<void> {
    const result = await firstValueFrom(this.complianceService.checkCountry(country));

    if (!this.anomalyReport) {
      return;
    }

    if (result.error) {
      this.addCountryCheckSkippedIssue(country, result.error);
      return;
    }

    if (!result.flagged) {
      return;
    }

    // Message comes straight from the backend, which knows whether this is
    // an OFAC hit or a FATF AML-risk hit and words it accordingly — do not
    // reconstruct wording here, that's exactly how "Vietnam is sanctioned"
    // (false) could end up said instead of "Vietnam needs enhanced due
    // diligence" (true).
    const issue: AnomalyIssue = {
      id: `sanction_country_${Date.now()}`,
      type: 'sanction',
      severity: result.severity === 'critical' ? 'critical' : 'warning',
      field: 'country',
      value: result.name ?? country,
      message: (context ? `${context}: ` : '') +
        (result.message ?? `${result.name} was flagged during country screening`),
      suggestion: this.countrySanctionSuggestion(result)
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + (issue.severity === 'critical' ? 1 : 0),
      warningCount: this.anomalyReport.warningCount + (issue.severity === 'warning' ? 1 : 0),
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: issue.severity === 'critical' ? 'FAILED'
        : this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /**
   * Three list types, three different truths - collapsing this to a binary
   * OFAC/not-OFAC check (as an earlier version did) said "Not sanctioned"
   * about a BANK_PROVIDED entry the bank itself marked BANK_SANCTIONED,
   * which is the same category of error the "Miranda Shipping" bug was:
   * a confident, wrong compliance signal. Bank-provided data is attributed
   * to the bank's own policy, never worded as if it were FATF's.
   */
  private countrySanctionSuggestion(result: CountryCheckResult): string {
    switch (result.listType) {
      case 'OFAC_SANCTIONS':
        return result.severity === 'critical'
          ? 'Halt processing — requires compliance review before proceeding'
          : `Requires compliance review. Verified ${result.verifiedDate} against ${result.source}`;
      case 'BANK_PROVIDED':
        return result.tier === 'BANK_SANCTIONED'
          ? 'Halt processing — treated as sanctioned under the bank\'s own compliance policy'
          : `Requires enhanced due diligence per the bank's own compliance policy. Verified ${result.verifiedDate}.`;
      case 'FATF_AML_RISK':
      default:
        return `Not sanctioned — apply enhanced due diligence per FATF guidance. Verified ${result.verifiedDate}.`;
    }
  }

  /**
   * HS code price-range check against edms-examination-service, folded into
   * the anomaly report the same way the country check is.
   *
   * Always a warning, never critical: per the 2026-09-07 meeting this flags
   * for review and does not block processing ("warning generate kerna hai").
   * An out-of-range price is a reason to look, not proof of wrongdoing — the
   * reference ranges are broad and legitimate trades do fall outside them.
   */
  private async checkHsCodePricing(hsCode: string, rawPrice: string): Promise<void> {
    const price = Number(String(rawPrice).replace(/,/g, ''));
    if (!Number.isFinite(price)) return;

    const result: HsCodePriceCheckResult =
      await firstValueFrom(this.complianceService.checkHsCodePrice(hsCode, price));

    if (!this.anomalyReport || !result.flagged) {
      return;
    }

    // Message comes from the backend, which knows the actual range and
    // direction — same reasoning as checkCountrySanctions, don't rebuild
    // the wording here.
    const issue: AnomalyIssue = {
      id: `pricing_hscode_${Date.now()}`,
      type: 'financial',
      severity: 'warning',
      field: 'unitPrice',
      value: rawPrice,
      message: result.message
        ?? `Declared price is outside the expected range for HS code ${hsCode}`,
      suggestion: result.direction === 'UNDER'
        ? 'Possible under-invoicing — verify the declared value against the commercial contract before processing'
        : 'Possible over-invoicing — verify the declared value against the commercial contract before processing'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      warningCount: this.anomalyReport.warningCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /**
   * HS code + destination country export-control check against
   * edms-examination-service, per Imad (senior dev, 2026-09-17). Distinct
   * from checkHsCodePricing above: that one flags an implausible declared
   * price, this one flags the trade itself as restricted at any price —
   * e.g. dual-use telecom equipment into Iran is a compliance issue
   * regardless of what it's invoiced at.
   */
  private async checkHsCodeSanction(hsCode: string, country: string): Promise<void> {
    const result: HsCodeSanctionCheckResult =
      await firstValueFrom(this.complianceService.checkHsCodeSanction(hsCode, country));

    if (!this.anomalyReport) {
      return;
    }

    if (result.error) {
      this.addHsCodeSanctionCheckSkippedIssue(hsCode, result.error);
      return;
    }

    if (!result.flagged) {
      return;
    }

    const isCritical = result.severity === 'critical';
    const issue: AnomalyIssue = {
      id: `sanction_hscode_${Date.now()}`,
      type: 'sanction',
      severity: isCritical ? 'critical' : 'warning',
      field: 'hsCode',
      value: hsCode,
      message: result.message ?? `HS code ${hsCode} is restricted for ${result.countryName ?? country}`,
      suggestion: isCritical
        ? 'Halt processing — this commodity is export-controlled for the declared destination, requires compliance review'
        : 'Requires enhanced due diligence — this commodity needs export license review for the declared destination'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + (isCritical ? 1 : 0),
      warningCount: this.anomalyReport.warningCount + (isCritical ? 0 : 1),
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: isCritical ? 'FAILED'
        : this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  private async loadComplianceLists(): Promise<void> {
    try {
      this.knownPorts = await firstValueFrom(this.complianceService.getAllPorts());
    } catch {
      this.knownPorts = [];
    }
    try {
      this.listedCountries = await firstValueFrom(this.complianceService.getAllCountries());
    } catch {
      this.listedCountries = [];
    }
  }

  /** Upper-cases and reduces to space-separated A-Z/0-9 words, padded with spaces so `includes` matches whole words only. */
  private normalizeForMatch(text: string): string {
    return ' ' + text.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim() + ' ';
  }

  /** Port text -> UN/LOCODE. Exact code first, then the longest listed port name found as whole words; otherwise the text as-is. */
  private resolvePortCode(text: string): string {
    const raw = text.trim();
    const byCode = this.knownPorts.find(p => p.unlocode.toUpperCase() === raw.toUpperCase());
    if (byCode) return byCode.unlocode.toUpperCase();

    const haystack = this.normalizeForMatch(raw);
    let best: StoredPort | undefined;
    let bestLen = 0;
    for (const p of this.knownPorts) {
      const needle = this.normalizeForMatch(p.portName);
      if (needle.trim() && haystack.includes(needle) && needle.length > bestLen) {
        best = p;
        bestLen = needle.length;
      }
    }
    return best ? best.unlocode.toUpperCase() : raw;
  }

  /** First listed country whose name or alias appears in the text as whole words (longest alias wins). */
  private findListedCountry(text: string): StoredCountry | undefined {
    const haystack = this.normalizeForMatch(text);
    let best: StoredCountry | undefined;
    let bestLen = 0;
    for (const c of this.listedCountries) {
      for (const name of [c.name, ...(c.aliases ?? [])]) {
        const needle = this.normalizeForMatch(name);
        if (needle.trim() && haystack.includes(needle) && needle.length > bestLen) {
          best = c;
          bestLen = needle.length;
        }
      }
    }
    return best;
  }

  /**
   * Country check for documents with no "Country:" field — reads the country
   * out of the port text instead. One check per distinct country.
   */
  private async checkCountriesFromPorts(fields: ExtractedValues): Promise<void> {
    const ports = [
      { text: fields.portOfLoading, label: 'Port of loading country' },
      { text: fields.portOfDischarge, label: 'Port of discharge country' }
    ];

    const alreadyChecked = new Set<string>();
    for (const port of ports) {
      if (!port.text) continue;

      const country = this.findListedCountry(port.text);
      if (!country || alreadyChecked.has(country.isoCode)) continue;

      alreadyChecked.add(country.isoCode);
      this.processingStep = 'Checking sanctions…';
      await this.checkCountrySanctions(country.name, port.label);
    }
  }

  /**
   * Port screening against edms-examination-service (2026-09-08 discussion).
   * Called once per port field found (loading, discharge) - each is an
   * independent signal, not merged into one check, same reasoning as
   * vessel flag-check vs vessel-sanction-check being kept separate.
   *
   * The backend already tells us WHY it's flagged (reason: PORT_SANCTIONED
   * for a direct per-port entry vs COUNTRY_SANCTIONED for the port's country)
   * and reuses the exact country-sanction wording for the latter - don't
   * rebuild that wording here either.
   */
  private async checkPortSanctions(portText: string, fieldName: string, label: string): Promise<void> {
    // The backend matches on UN/LOCODE only. BOLs print the code; LCs print
    // a name ("JEBEL ALI PORT UAE"), so resolve name -> code from the bank's
    // own port list first. Unresolved text goes through unchanged, as before.
    const unlocode = this.resolvePortCode(portText);
    const result: PortCheckResult = await firstValueFrom(this.complianceService.checkPort(unlocode));

    if (!this.anomalyReport || !result.flagged) {
      return;
    }

    const issue: AnomalyIssue = {
      id: `sanction_port_${fieldName}_${Date.now()}`,
      type: 'sanction',
      severity: result.severity === 'critical' ? 'critical' : 'warning',
      field: fieldName,
      value: portText,
      message: `${label} (${unlocode}): ${result.message ?? 'flagged during port screening'}`,
      suggestion: result.reason === 'COUNTRY_SANCTIONED'
        ? (result.severity === 'critical'
            ? 'Halt processing — port is located in a sanctioned country, requires compliance review'
            : 'Requires enhanced due diligence — port is located in a high-risk country per the bank\'s compliance policy')
        : (result.severity === 'critical'
            ? `Halt processing — port is directly sanctioned on record, requires compliance review. Verified ${result.verifiedDate}.`
            : `Requires enhanced due diligence — known high-risk port on record. Verified ${result.verifiedDate}.`)
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + (issue.severity === 'critical' ? 1 : 0),
      warningCount: this.anomalyReport.warningCount + (issue.severity === 'warning' ? 1 : 0),
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: issue.severity === 'critical' ? 'FAILED'
        : this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /**
   * Route deviation check against the vessel's live AIS position
   * (2026-09-08/09 discussion, Imad's China→Pakistan-via-Dubai example).
   *
   * Warning, never critical: a mismatch means the vessel's actual last port
   * or destination differs from what the BOL declares, which is a reason to
   * look — legitimate reasons exist (transhipment legs, updated voyage
   * plans, stale AIS destination fields that crews often don't update).
   * Treating it as proof of wrongdoing would be the same overreach as the
   * "Miranda Shipping" false positive.
   */
  /**
   * Country check that couldn't run (service down, misconfigured, etc).
   * Surfaces the skip as a visible info-level issue so OFAC/FATF baselines
   * aren't accidentally treated as clean when the check never happened.
   */
  private addCountryCheckSkippedIssue(country: string, reason: string): void {
    if (!this.anomalyReport) return;

    const issue: AnomalyIssue = {
      id: `sanction_country_skip_${Date.now()}`,
      type: 'sanction',
      severity: 'info',
      field: 'country',
      value: country,
      message: `Country sanctions check not performed: ${reason}`,
      suggestion: 'This check did not run - treat as unverified, not as passed'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      infoCount: this.anomalyReport.infoCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1
    };
  }

  /** Same reasoning as addCountryCheckSkippedIssue, for the HS code export-control check. */
  private addHsCodeSanctionCheckSkippedIssue(hsCode: string, reason: string): void {
    if (!this.anomalyReport) return;

    const issue: AnomalyIssue = {
      id: `sanction_hscode_skip_${Date.now()}`,
      type: 'sanction',
      severity: 'info',
      field: 'hsCode',
      value: hsCode,
      message: `HS code export-control check not performed: ${reason}`,
      suggestion: 'This check did not run - treat as unverified, not as passed'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      infoCount: this.anomalyReport.infoCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1
    };
  }

  /**
   * A vessel check that returns an "error" ran into something that stopped
   * it from actually checking anything - no DATADOCKED_API_KEY configured,
   * the service unreachable, or no data for this vessel. Every caller below
   * used to just return on `!result.flagged`, which treats "could not
   * check" identically to "checked, found nothing" - a document with a
   * skipped vessel check looked exactly like a clean PASS. This surfaces
   * the skip as a visible info-level issue instead.
   */
  private addVesselCheckSkippedIssue(checkName: string, imo: string, reason: string): void {
    if (!this.anomalyReport) return;

    const issue: AnomalyIssue = {
      id: `vessel_skip_${Date.now()}`,
      type: 'sanction',
      severity: 'info',
      field: 'vesselImo',
      value: imo,
      message: `${checkName} not performed: ${reason}`,
      suggestion: 'This check did not run - treat as unverified, not as passed'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      infoCount: this.anomalyReport.infoCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1
    };
  }

  private async checkRouteDeviation(imo: string, portOfLoading: string, portOfDischarge: string): Promise<void> {
    const result: RouteDeviationResult =
      await firstValueFrom(this.vesselService.checkRouteDeviation(imo, portOfLoading, portOfDischarge));

    if (!this.anomalyReport) {
      return;
    }

    if (result.error) {
      this.addVesselCheckSkippedIssue('Vessel route deviation check', imo, result.error);
      return;
    }

    if (!result.flagged) {
      return;
    }

    // Both halves can mismatch independently — report whichever actually did,
    // rather than one vague "route looks wrong" line.
    const details = [result.loadingMessage, result.dischargeMessage]
      .filter((m): m is string => !!m)
      .join(' | ');

    const issue: AnomalyIssue = {
      id: `vessel_route_${Date.now()}`,
      type: 'sanction',
      severity: 'warning',
      field: 'vesselImo',
      value: imo,
      message: `Vessel ${result.vesselName ?? imo}: ${details}`,
      suggestion: 'Verify the actual voyage against the declared route — an unscheduled port call '
        + 'can indicate transhipment or cargo substitution, but also has legitimate explanations'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      warningCount: this.anomalyReport.warningCount + 1,
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /**
   * Flag State Check (Imad confirmed 2026-09-08). A vessel registered under
   * a sanctioned/high-risk flag is a signal on its own, independent of
   * whether the ship itself is ban-listed - dark-fleet ships re-flag to
   * clean registries specifically to defeat this check, which is why the
   * two are kept separate rather than merged.
   *
   * Severity comes from the backend, which reuses the same country tier
   * mapping the country/port checks use - don't re-derive it here.
   */
  private async checkVesselFlagState(imo: string): Promise<void> {
    const result: FlagStateResult = await firstValueFrom(this.vesselService.checkFlagState(imo));

    if (!this.anomalyReport) {
      return;
    }

    if (result.error) {
      this.addVesselCheckSkippedIssue('Vessel flag state check', imo, result.error);
      return;
    }

    if (!result.flagged) {
      return;
    }

    const isCritical = result.severity === 'critical';
    const issue: AnomalyIssue = {
      id: `vessel_flag_${Date.now()}`,
      type: 'sanction',
      severity: isCritical ? 'critical' : 'warning',
      field: 'vesselImo',
      value: result.flagCountry ?? imo,
      message: result.message ?? `Vessel ${result.vesselName ?? imo} is flagged in a listed country`,
      suggestion: isCritical
        ? 'Halt processing — vessel is registered under a sanctioned flag, requires compliance review'
        : 'Requires enhanced due diligence — vessel is registered under a high-risk flag'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + (isCritical ? 1 : 0),
      warningCount: this.anomalyReport.warningCount + (isCritical ? 0 : 1),
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: isCritical ? 'FAILED'
        : this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /**
   * Ownership/Management Screening (Imad confirmed 2026-09-08). Screens the
   * registered owner and manager against OpenSanctions via the existing
   * Entity Screening module.
   *
   * A watchlist hit on the party that owns or operates the vessel is a
   * critical finding, unlike a route deviation - this is a named match
   * against a real watchlist, not a circumstantial signal.
   */
  private async checkVesselOwnership(imo: string): Promise<void> {
    const result: OwnershipScreeningResult = await firstValueFrom(this.vesselService.checkOwnership(imo));

    if (!this.anomalyReport) {
      return;
    }

    if (result.error) {
      this.addVesselCheckSkippedIssue('Vessel ownership screening', imo, result.error);
      return;
    }

    if (!result.flagged) {
      return;
    }

    // Severity/message come from the backend, which now distinguishes a real
    // sanctions-topic hit from a hit on a non-sanctions dataset (e.g. a port
    // state control detention record) — don't reconstruct or override that
    // here, same reasoning as checkCountrySanctions.
    const isCritical = result.severity === 'critical';
    const hits = (result.screened ?? [])
      .filter(p => p.hasMatch === true)
      .map(p => `${p.role === 'manager' ? 'Manager' : 'Registered owner'} "${p.name}"`)
      .join(', ');

    const issue: AnomalyIssue = {
      id: `vessel_ownership_${Date.now()}`,
      type: 'sanction',
      severity: isCritical ? 'critical' : 'warning',
      field: 'vesselImo',
      value: imo,
      message: `Vessel ${result.vesselName ?? imo}: ${hits} — ${result.message ?? 'matched a watchlist'}`,
      suggestion: isCritical
        ? 'Do not process until a compliance officer reviews the ownership match'
        : 'Review recommended — matched a non-sanctions watchlist entry, not confirmed as sanctioned'
    };

    this.anomalyReport = {
      ...this.anomalyReport,
      issues: [...this.anomalyReport.issues, issue],
      criticalCount: this.anomalyReport.criticalCount + (isCritical ? 1 : 0),
      warningCount: this.anomalyReport.warningCount + (isCritical ? 0 : 1),
      totalIssues: this.anomalyReport.totalIssues + 1,
      overallStatus: isCritical ? 'FAILED'
        : this.anomalyReport.overallStatus === 'FAILED' ? 'FAILED' : 'WARNING'
    };
  }

  /** Flattens the extracted fields into a plain name-to-value object. */
  private buildExtractionObject(): ExtractedValues {
    const values: ExtractedValues = {};

    for (const field of this.fieldExtractionResult?.fields ?? []) {
      values[field.fieldName] = field.value;
    }

    // The anomaly detector uses this to pick the right required-field set
    // per document type — an LC has no accountNumber, for instance.
    if (this.fieldExtractionResult?.documentType) {
      values.documentType = this.fieldExtractionResult.documentType;
    }
    return values;
  }

  resetAnalysis(): void {
    this.ocrResult = null;
    this.fieldExtractionResult = null;
    this.duplicateCheckResult = null;
    this.anomalyReport = null;
    this.showAnalysisPanel = false;
    this.savedAnalysisId = null;
    this.saveError = '';
    this.entityCheckResult = null;
    this.entityCheckError = '';
    this.preExtractedOcr = null;
    this.dmsSaveResult = '';
    this.dmsSaveError = '';
  }

  setupCanvasEvents() {
    this.documentCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.documentCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.documentCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.documentCanvas.addEventListener('click', (e) => this.onCanvasClick(e));
  }

  onCanvasClick(e: MouseEvent) {
    if (!this.documentImage || this.isSelecting) return;
    this.viewMode = 'preview';
  }

  closePreview() {
    this.viewMode = 'normal';
  }

  onMouseDown(e: MouseEvent) {
    if (!this.selectionMode || !this.documentImage || this.viewMode === 'preview') return;

    const rect = this.documentCanvas.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    this.isSelecting = true;
  }

  onMouseMove(e: MouseEvent) {
    if (!this.isSelecting || !this.documentImage || this.viewMode === 'preview') return;

    const rect = this.documentCanvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    this.ctx.drawImage(this.documentImage, 0, 0);

    this.ctx.strokeStyle = '#FF6B35';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      this.startX,
      this.startY,
      currentX - this.startX,
      currentY - this.startY
    );
  }

  async onMouseUp(e: MouseEvent) {
    if (!this.isSelecting || !this.documentImage) return;

    const rect = this.documentCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    this.isSelecting = false;

    const x1 = Math.min(this.startX, endX);
    const y1 = Math.min(this.startY, endY);
    const x2 = Math.max(this.startX, endX);
    const y2 = Math.max(this.startY, endY);

    if (Math.abs(x2 - x1) > 50 && Math.abs(y2 - y1) > 50) {
      await this.extractRegionData(x1, y1, x2, y2);
    }

    this.ctx.drawImage(this.documentImage, 0, 0);
    this.redrawExtractionBoxes();
  }

  async extractRegionData(x1: number, y1: number, x2: number, y2: number) {
    const width = x2 - x1;
    const height = y2 - y1;

    // Run OCR on selected region
    const regionOcr = await this.ocrService.extractTextFromRegion(
      this.documentCanvas, x1, y1, width, height
    );

    const extraction: ExtractedData = {
      id: `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: regionOcr.text || `[No text detected in ${width}x${height}px region]`,
      coordinates: { x1, y1, x2, y2 },
      timestamp: new Date()
    };

    this.extractedDataList.push(extraction);
    logger.debug('Region extracted:', extraction);
  }

  redrawExtractionBoxes() {
    if (!this.documentImage) return;

    this.extractedDataList.forEach((data, index) => {
      const c = data.coordinates;
      this.ctx.strokeStyle = '#4CAF50';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(c.x1, c.y1, c.x2 - c.x1, c.y2 - c.y1);

      this.ctx.fillStyle = '#4CAF50';
      this.ctx.font = 'bold 14px Arial';
      this.ctx.fillText(`Extract ${index + 1}`, c.x1 + 5, c.y1 - 5);
    });
  }

  deleteExtraction(id: string) {
    this.extractedDataList = this.extractedDataList.filter(e => e.id !== id);

    if (this.documentImage) {
      this.ctx.drawImage(this.documentImage, 0, 0);
      this.redrawExtractionBoxes();
    }
  }

  /**
   * Product codes the live DMS accepts. Probed against dmsclientext on
   * 2026-09-19: ILC, INV, ACC, CUS, MAA and SRT save (HTTP 200); BL, PO and
   * RCP fail with HTTP 500 "Failed to upload file" because those collections
   * do not exist on the backend yet. Add a code here once Imad ships it.
   */
  private static readonly SUPPORTED_PRODUCTS = new Set(['ILC', 'INV', 'ACC', 'CUS', 'MAA', 'SRT']);

  /** Short code for the detected document type (used in the reference). SRT when unrecognised. */
  private docCodeFor(documentType: string): string {
    const map: Record<string, string> = {
      'IMPORT_LETTER_OF_CREDIT': 'ILC',
      'LETTER_OF_CREDIT':        'ILC',
      'BILL_OF_LADING':          'BL',
      'INVOICE':                 'INV',
      'PURCHASE_ORDER':          'PO',
      'BANK_STATEMENT':          'ACC',
      'RECEIPT':                 'RCP',
    };
    return map[documentType] ?? 'SRT';
  }

  /**
   * DMS product code the document is actually saved under. A type whose
   * collection is not built yet (BL, PO, RCP) goes to SRT, the scanner
   * catch-all, instead of failing the save; the reference still records
   * the real type (SRT-BL-...).
   */
  private resolveProductCode(documentType: string): string {
    const code = this.docCodeFor(documentType);
    return DocumentScannerComponent.SUPPORTED_PRODUCTS.has(code) ? code : 'SRT';
  }

  /**
   * Save the scanned document to the DMS under the product code that matches
   * the detected document type (ILC for import LCs, BL for bills of lading,
   * etc.). Falls back to SRT when the type is unrecognised.
   * Runs against /api/dms/save (multipart); the auth interceptor attaches
   * the JWT automatically.
   */
  async proceedAndSaveToDms() {
    if (!this.uploadedFile) {
      this.dmsSaveError = 'No document uploaded to save.';
      return;
    }

    this.isSavingToDms = true;
    this.dmsSaveError = '';
    this.dmsSaveResult = '';

    const docType    = this.fieldExtractionResult?.documentType ?? 'UNKNOWN';
    const productCode = this.resolveProductCode(docType);
    const summary    = this.buildDmsDescription();
    // Per Imad (2026-09-19): every tnxreference from the Scanner tool
    // must carry an "SRT" prefix regardless of the product code, so the
    // DMS can tell scanner-generated saves apart from other systems'
    // writes that share the same collection. Product code still routes
    // to the right documentmaster<code> collection; the middle part is the
    // real document type even when it had to be saved under SRT.
    const tnxRef     = `SRT-${this.docCodeFor(docType)}-${Date.now()}`;
    const appUser    = this.currentLoginId();

    const fd = new FormData();
    fd.append('file', this.uploadedFile, this.uploadedFileName || this.uploadedFile.name);
    fd.append('appuserid', appUser);
    fd.append('tnxreference', tnxRef);
    fd.append('tnxreferenceaction', 'SAVE');
    fd.append('description', summary);
    fd.append('documentstatus', 'A');
    fd.append('documentcat', 'TRADE');
    fd.append('docdoccat', 'Scan Report');
    fd.append('productcode', productCode);

    try {
      const base = environment.apiUrl;
      const res = await firstValueFrom(
        this.http.post(`${base}/dms/save`, fd, { responseType: 'text' })
      );
      this.dmsSaveResult = `Sent to DMS as ${productCode} (tnxreference: ${tnxRef}). ${res ?? ''}`.trim();

      // Second record, same reference: the analysis report, filed under SRT.
      // A failure here must not hide that the document itself was sent.
      try {
        await this.fileAnalysisReport(base, tnxRef, docType, productCode, appUser);
        this.dmsSaveResult += ' Analysis report also filed under SRT.';
      } catch {
        this.dmsSaveError = 'The document was sent, but its analysis report could not be filed under SRT.';
      }
    } catch (err: any) {
      const status = err?.status;
      if (status === 403) {
        this.dmsSaveError =
          `Access denied (403) — the DMS backend rejected the request. ` +
          `Most likely cause: CSRF protection is enabled on /dms/save. ` +
          `Imad must disable CSRF for API routes in Spring Security config.`;
      } else if (status === 401) {
        this.dmsSaveError = `Session expired (401) — please log in again and retry.`;
      } else if (status === 404) {
        this.dmsSaveError = `Product code "${productCode}" not found (404) — Imad must add it to dms.products in clientapplication.properties and redeploy the JAR.`;
      } else {
        this.dmsSaveError =
          err?.error?.message ??
          (typeof err?.error === 'string' ? err.error : null) ??
          err?.message ??
          `Sending to DMS failed (HTTP ${status ?? 'unknown'}).`;
      }
    } finally {
      this.isSavingToDms = false;
    }
  }

  get dmsProductCode(): string {
    return this.resolveProductCode(this.fieldExtractionResult?.documentType ?? 'UNKNOWN');
  }

  get dmsCollectionName(): string {
    return `documentmaster${this.dmsProductCode.toLowerCase()}`;
  }

  /**
   * Files the analysis report as its own DMS record under product code SRT,
   * with the SAME transaction reference as the document, so one reference
   * finds both. The DMS only accepts pdf/txt/jpg/png/doc/docx/xls/xlsx, so the
   * report is a readable .txt file (JSON would be rejected).
   */
  private async fileAnalysisReport(base: string, tnxRef: string, docType: string, productCode: string, appUser: string): Promise<void> {
    const original = this.uploadedFileName || this.uploadedFile?.name || 'document';
    const stem = original.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_');
    const text = this.buildAnalysisReportText(tnxRef, docType, productCode, appUser);

    const fd = new FormData();
    fd.append('file', new File([text], `${stem}-analysis-report.txt`, { type: 'text/plain' }));
    fd.append('appuserid', appUser);
    fd.append('tnxreference', tnxRef);
    fd.append('tnxreferenceaction', 'SAVE');
    fd.append('description', this.buildDmsDescription('Analysis Report'));
    fd.append('documentstatus', 'A');
    fd.append('documentcat', 'TRADE');
    fd.append('docdoccat', 'Analysis Report');
    fd.append('productcode', 'SRT');

    await firstValueFrom(this.http.post(`${base}/dms/save`, fd, { responseType: 'text' }));
  }

  private buildAnalysisReportText(tnxRef: string, docType: string, productCode: string, appUser: string): string {
    const pct = (v: number | undefined) => (v === undefined || v === null ? '-' : `${(v <= 1 ? v * 100 : v).toFixed(1)}%`);
    const L: string[] = [];
    L.push('DOCUFINDER ANALYSIS REPORT');
    L.push('==========================');
    L.push(`Document       : ${this.uploadedFileName}`);
    L.push(`Reference      : ${tnxRef}`);
    L.push(`Document type  : ${docType} (match ${pct(this.fieldExtractionResult?.overallConfidence)})`);
    L.push(`Document filed : ${productCode}`);
    L.push(`Analysed / sent: ${new Date().toISOString()} by ${appUser}`);
    L.push(`Analysis ID    : ${this.savedAnalysisId ?? '(not stored on the server)'}`);
    L.push(`Text read via  : ${this.ocrResult ? `confidence ${pct(this.ocrResult.confidence)}` : 'n/a'}`);
    L.push('');

    const fields = this.fieldExtractionResult?.fields ?? [];
    L.push(`EXTRACTED FIELDS (${fields.length})`);
    fields.forEach(f => L.push(`  ${f.fieldName}: ${f.value}  (${pct(f.confidence)})`));
    if (!fields.length) L.push('  none');
    L.push('');

    L.push('DUPLICATE CHECK');
    const dup = this.duplicateCheckResult;
    if (!dup) L.push('  not run');
    else if (dup.isDuplicate) L.push(`  Duplicate (${dup.matchType ?? 'match'}) of ${dup.existingDocumentId ?? 'an earlier upload'}`);
    else L.push('  No matching document found - this upload is new.');
    L.push('');

    const a = this.anomalyReport;
    L.push(`VALIDATION: ${a ? a.overallStatus : 'not run'}${a ? ` - ${a.criticalCount} critical, ${a.warningCount} warning, ${a.infoCount} info` : ''}`);
    (a?.issues ?? []).forEach(i => {
      L.push(`  [${i.severity.toUpperCase()}] ${i.type} / ${i.field}: ${i.message}`);
      if (i.suggestion) L.push(`      Suggested action: ${i.suggestion}`);
    });
    if (a && !a.issues.length) L.push('  All checks passed.');
    L.push('');
    L.push('The full analysis, including the recognised text, is stored on the server and can be loaded again from the Document Reader.');
    return L.join('\r\n');
  }

  private buildDmsDescription(label = 'Scan Report'): string {
    const parts: string[] = [label];
    if (this.fieldExtractionResult) {
      parts.push(`${this.fieldExtractionResult.fields.length} fields extracted`);
    }
    if (this.anomalyReport) {
      const a = this.anomalyReport;
      const bits: string[] = [];
      if (a.criticalCount) bits.push(`${a.criticalCount} critical`);
      if (a.warningCount) bits.push(`${a.warningCount} warning`);
      if (a.infoCount) bits.push(`${a.infoCount} info`);
      parts.push(bits.length ? `issues: ${bits.join(', ')}` : 'no issues');
    }
    // description column is short; keep it under ~200 chars.
    return parts.join(' — ').slice(0, 200);
  }

  /**
   * JWT's `sub` claim is the loginid — the backend expects that on save,
   * and it is what shows up in inputterid on the resulting record. Falls
   * back to 'SYSTEM' if the token is missing/unparseable rather than
   * refusing to save.
   */
  private currentLoginId(): string {
    const t = this.auth.getToken();
    if (!t) return 'SYSTEM';
    try {
      const payload = JSON.parse(atob(t.split('.')[1] || ''));
      return payload?.sub || 'SYSTEM';
    } catch {
      return 'SYSTEM';
    }
  }

  downloadExtractions() {
    const exportData = {
      filename: this.uploadedFileName,
      ocrResult: this.ocrResult,
      fieldExtraction: this.fieldExtractionResult,
      duplicateCheck: this.duplicateCheckResult,
      anomalyReport: this.anomalyReport,
      manualExtractions: this.extractedDataList
    };

    const json = JSON.stringify(exportData, null, 2);
    this.viewer.download(
      new Blob([json], { type: 'application/json' }),
      `document-analysis-${Date.now()}.json`
    );
  }

  clearAll() {
    this.extractedDataList = [];
    this.documentImage = null;
    this.uploadedFileName = '';
    this.uploadedFile = null;
    this.documentFileType = null;
    this.pdfSafeUrl = null;
    this.errorMessage = '';
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    this.resetAnalysis();
    if (this.documentCanvas) {
      this.ctx.clearRect(0, 0, this.documentCanvas.width, this.documentCanvas.height);
    }
    this.viewMode = 'normal';

    // Otherwise the next reload would restore what was just cleared.
    // The stored record itself stays - Clear resets the screen, it does
    // not delete an analysis that was already saved.
    localStorage.removeItem(DocumentScannerComponent.LAST_ANALYSIS_KEY);
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196f3';
      default: return '#757575';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PASS': return '#4caf50';
      case 'WARNING': return '#ff9800';
      case 'FAILED': return '#f44336';
      default: return '#757575';
    }
  }
}
