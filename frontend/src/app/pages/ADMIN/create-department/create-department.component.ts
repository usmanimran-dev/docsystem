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
import { DepartmentRecord, DepartmentRequest, RECORD_STATUS } from '../../../core/models/department.model';

@Component({
  selector: 'app-create-department',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './create-department.component.html',
  styleUrl: './create-department.component.scss'
})
export class CreateDepartmentComponent implements OnInit {
  departmentForm!: FormGroup;
  resultMessage = '';
  errorMessage = '';
  busy = false;

  // Null until a record exists — either loaded from Inquiries or just saved.
  loaded: DepartmentRecord | null = null;

  readonly STATUS = RECORD_STATUS;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    this.loaded = this.recordFromNavigation();
  }

  /**
   * The row Inquiries passed through navigation state, or null when opening a
   * blank form. (The backend's searchdepartment endpoint cannot be used yet —
   * see the notes in the service.)
   */
  private recordFromNavigation(): DepartmentRecord | null {
    // getCurrentNavigation() is only populated while a navigation is running,
    // which is true in the constructor. Afterwards the same object is on
    // history.state instead.
    const navigation = this.router.getCurrentNavigation();
    const state = navigation ? navigation.extras.state : history.state;
    return state?.['record'] ?? null;
  }

  ngOnInit(): void {
    this.departmentForm = this.fb.group({
      departmentcode: ['', Validators.required],
      departmentname: ['', Validators.required],
      departmentstatus: [RECORD_STATUS.APPROVED, Validators.required]
    });

    this.applyLoadedState();

    // Router config uses onSameUrlNavigation: 'reload', so navigating here
    // again (e.g. clicking "Create Department" in the sidebar right after
    // opening a record) fires NavigationEnd without recreating this
    // component - re-read state.record each time instead of only in the
    // constructor, otherwise the form keeps showing the previous record.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd =>
          event instanceof NavigationEnd && event.urlAfterRedirects.includes('CreateDepartment')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loaded = this.recordFromNavigation();
        this.departmentForm.enable();
        this.departmentForm.reset({
          departmentcode: '',
          departmentname: '',
          departmentstatus: RECORD_STATUS.APPROVED
        });
        this.resultMessage = '';
        this.errorMessage = '';
        this.applyLoadedState();
      });
  }

  private applyLoadedState(): void {
    if (this.loaded) {
      this.departmentForm.patchValue({
        departmentcode: this.loaded.departmentcode,
        departmentname: this.loaded.departmentname,
        departmentstatus: this.loaded.departmentstatus
      });
      this.departmentForm.get('departmentcode')?.disable();
    }

    if (this.isApproved) {
      this.departmentForm.disable();
    }
  }

  get recordStatus(): string | null {
    return this.loaded?.recordstatus ?? null;
  }

  get isNew(): boolean {
    return this.loaded === null;
  }

  get isSaved(): boolean {
    return this.recordStatus === RECORD_STATUS.SAVED;
  }

  get isSubmitted(): boolean {
    return this.recordStatus === RECORD_STATUS.SUBMITTED;
  }

  get isApproved(): boolean {
    return this.recordStatus === RECORD_STATUS.APPROVED;
  }

  private buildPayload(): DepartmentRequest {
    const raw = this.departmentForm.getRawValue();
    return {
      departmentcode: raw.departmentcode,
      departmentname: raw.departmentname,
      departmentstatus: raw.departmentstatus,
      appuserid: sessionStorage.getItem('loggedInUserId')
    };
  }

  private run(
    call: (payload: DepartmentRequest) => ReturnType<ApiService['saveDepartment']>,
    successMessage: string
  ): void {
    if (this.departmentForm.invalid) {
      this.departmentForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.resultMessage = '';
    this.errorMessage = '';

    call.call(this.api, this.buildPayload()).subscribe({
      next: (record) => {
        this.busy = false;
        this.loaded = record;
        this.departmentForm.get('departmentcode')?.disable();
        this.resultMessage = successMessage;
        if (this.isApproved) {
          this.departmentForm.disable();
        }
      },
      error: (err) => {
        this.busy = false;
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Request failed';
      }
    });
  }

  onSave(): void {
    this.run(this.api.saveDepartment, 'Department saved. Submit it for authorization when ready.');
  }

  onUpdate(): void {
    this.run(this.api.updateDepartment, 'Department updated.');
  }

  onSubmit(): void {
    this.run(this.api.submitDepartment, 'Submitted for authorization.');
  }

  onApprove(): void {
    this.run(this.api.approveDepartment, 'Department approved.');
  }

  onReject(): void {
    this.run(this.api.rejectDepartment, 'Department rejected.');
  }

  onReset(): void {
    this.departmentForm.reset({
      departmentcode: '',
      departmentname: '',
      departmentstatus: RECORD_STATUS.APPROVED
    });
    this.departmentForm.enable();
    this.loaded = null;
    this.resultMessage = '';
    this.errorMessage = '';
  }

  onBack(): void {
    this.router.navigate(['/adminPanel/DepartmentInquiries']);
  }
}
