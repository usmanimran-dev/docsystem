import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DocumentTypeRecord, DocumentTypeRequest, DOC_TYPE_RECORD_STATUS } from '../../../core/models/document-type.model';

@Component({
  selector: 'app-create-document-type',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './create-document-type.component.html',
  styleUrl: './create-document-type.component.scss'
})
export class CreateDocumentTypeComponent implements OnInit {
  documentTypeForm!: FormGroup;
  resultMessage = '';
  errorMessage = '';
  busy = false;

  // Null until a record exists — either loaded from Inquiries or just saved.
  loaded: DocumentTypeRecord | null = null;

  readonly STATUS = DOC_TYPE_RECORD_STATUS;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    this.loaded = this.recordFromNavigation();
  }

  /** The row Inquiries passed through navigation state, or null for a blank form. */
  private recordFromNavigation(): DocumentTypeRecord | null {
    // getCurrentNavigation() is only populated while a navigation is running,
    // which is true in the constructor. Afterwards the same object is on
    // history.state instead.
    const navigation = this.router.getCurrentNavigation();
    const state = navigation ? navigation.extras.state : history.state;
    return state?.['record'] ?? null;
  }

  ngOnInit(): void {
    this.documentTypeForm = this.fb.group({
      documenttypeid: ['', Validators.required],
      documenttype: ['', Validators.required],
      documentypestatus: [DOC_TYPE_RECORD_STATUS.APPROVED, Validators.required]
    });

    this.applyLoadedState();

    // Router config uses onSameUrlNavigation: 'reload', so navigating here
    // again (e.g. clicking "Create Document Type" in the sidebar right
    // after opening a record) fires NavigationEnd without recreating this
    // component - re-read state.record each time instead of only in the
    // constructor, otherwise the form keeps showing the previous record.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd =>
          event instanceof NavigationEnd && event.urlAfterRedirects.includes('CreateDocumentType')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loaded = this.recordFromNavigation();
        this.documentTypeForm.enable();
        this.documentTypeForm.reset({
          documenttypeid: '',
          documenttype: '',
          documentypestatus: DOC_TYPE_RECORD_STATUS.APPROVED
        });
        this.resultMessage = '';
        this.errorMessage = '';
        this.applyLoadedState();
      });
  }

  private applyLoadedState(): void {
    if (this.loaded) {
      this.documentTypeForm.patchValue({
        documenttypeid: this.loaded.documenttypeid,
        documenttype: this.loaded.documenttype,
        documentypestatus: this.loaded.documentypestatus
      });
      this.documentTypeForm.get('documenttypeid')?.disable();
    }

    if (this.isApproved) {
      this.documentTypeForm.disable();
    }
  }

  get recordStatus(): string | null {
    return this.loaded?.recordstatus ?? null;
  }

  get isNew(): boolean {
    return this.loaded === null;
  }

  get isSaved(): boolean {
    return this.recordStatus === DOC_TYPE_RECORD_STATUS.SAVED;
  }

  get isSubmitted(): boolean {
    return this.recordStatus === DOC_TYPE_RECORD_STATUS.SUBMITTED;
  }

  get isApproved(): boolean {
    return this.recordStatus === DOC_TYPE_RECORD_STATUS.APPROVED;
  }

  private buildPayload(): DocumentTypeRequest {
    const raw = this.documentTypeForm.getRawValue();
    return {
      documenttypeid: raw.documenttypeid,
      documenttype: raw.documenttype,
      documentypestatus: raw.documentypestatus,
      appuserid: sessionStorage.getItem('loggedInUserId')
    };
  }

  private run(
    call: (payload: DocumentTypeRequest) => ReturnType<ApiService['saveDocumentType']>,
    successMessage: string
  ): void {
    if (this.documentTypeForm.invalid) {
      this.documentTypeForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.resultMessage = '';
    this.errorMessage = '';

    call.call(this.api, this.buildPayload()).subscribe({
      next: (record) => {
        this.busy = false;
        this.loaded = record;
        this.documentTypeForm.get('documenttypeid')?.disable();
        this.resultMessage = successMessage;
        if (this.isApproved) {
          this.documentTypeForm.disable();
        }
      },
      error: (err) => {
        this.busy = false;
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Request failed';
      }
    });
  }

  onSave(): void {
    this.run(this.api.saveDocumentType, 'Document type saved. Submit it for authorization when ready.');
  }

  onUpdate(): void {
    this.run(this.api.updateDocumentType, 'Document type updated.');
  }

  onSubmit(): void {
    this.run(this.api.submitDocumentType, 'Submitted for authorization.');
  }

  onApprove(): void {
    this.run(this.api.approveDocumentType, 'Document type approved.');
  }

  onReject(): void {
    this.run(this.api.rejectDocumentType, 'Document type rejected.');
  }

  onReset(): void {
    this.documentTypeForm.reset({
      documenttypeid: '',
      documenttype: '',
      documentypestatus: DOC_TYPE_RECORD_STATUS.APPROVED
    });
    this.documentTypeForm.enable();
    this.loaded = null;
    this.resultMessage = '';
    this.errorMessage = '';
  }

  onBack(): void {
    this.router.navigate(['/adminPanel/DocumentTypeInquiries']);
  }
}
