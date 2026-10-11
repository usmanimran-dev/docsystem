import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DepartmentListItem, RECORD_STATUS } from '../../../core/models/department.model';
import { UserRecord, UserRequest } from '../../../core/models/user.model';

@Component({
  selector: 'app-create-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './create-user.component.html',
  styleUrl: './create-user.component.scss'
})
export class CreateUserComponent implements OnInit {
  userForm!: FormGroup;

  departments: DepartmentListItem[] = [];
  departmentsLoading = false;
  departmentsError = '';

  resultMessage = '';
  errorMessage = '';
  busy = false;

  // Null until a record exists — either opened from Inquiries or just saved.
  loaded: UserRecord | null = null;

  readonly STATUS = RECORD_STATUS;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router
  ) {
    this.loaded = this.recordFromNavigation();
  }

  /** The row Inquiries passed through navigation state, or null for a blank form. */
  private recordFromNavigation(): UserRecord | null {
    // getCurrentNavigation() is only populated while a navigation is running,
    // which is true in the constructor. Afterwards the same object is on
    // history.state instead.
    const navigation = this.router.getCurrentNavigation();
    const state = navigation ? navigation.extras.state : history.state;
    return state?.['record'] ?? null;
  }

  ngOnInit(): void {
    this.userForm = this.fb.group({
      loginid: ['', Validators.required],
      password: ['', Validators.required],
      username: ['', Validators.required],
      userstatus: ['A', Validators.required],
      usercat: ['U', Validators.required],
      departmentcode: [''],
      contactno: [''],
      emailid: [''],
      mailingaddress: [''],
      employeeid: ['']
    });

    this.applyLoadedState();
    this.loadDepartments();

    // Router config uses onSameUrlNavigation: 'reload', so navigating here
    // again (e.g. clicking "Create User" in the sidebar right after opening
    // a record) fires NavigationEnd without recreating this component -
    // re-read state.record each time instead of only in the constructor,
    // otherwise the form keeps showing the previous record.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd =>
          event instanceof NavigationEnd && event.urlAfterRedirects.includes('CreateUser')
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loaded = this.recordFromNavigation();
        this.userForm.enable();
        this.userForm.reset({
          loginid: '',
          password: '',
          username: '',
          userstatus: 'A',
          usercat: 'U',
          departmentcode: '',
          contactno: '',
          emailid: '',
          mailingaddress: '',
          employeeid: ''
        });
        this.userForm.get('password')?.setValidators(Validators.required);
        this.userForm.get('password')?.updateValueAndValidity();
        this.resultMessage = '';
        this.errorMessage = '';
        this.applyLoadedState();
      });
  }

  private applyLoadedState(): void {
    if (this.loaded) {
      this.userForm.patchValue({
        loginid: this.loaded.loginid,
        username: this.loaded.username,
        userstatus: this.loaded.userstatus,
        usercat: this.loaded.usercat,
        departmentcode: this.loaded.departmentcode ?? '',
        contactno: this.loaded.contactno ?? '',
        emailid: this.loaded.emailid ?? '',
        mailingaddress: this.loaded.mailingaddress ?? '',
        employeeid: ''
      });
      this.userForm.get('loginid')?.disable();
      // The response never returns the password, so it cannot be shown or
      // required again on an existing record.
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
    }

    if (this.isApproved) {
      this.userForm.disable();
    }
  }

  loadDepartments(): void {
    this.departmentsLoading = true;
    this.departmentsError = '';

    this.api.getDepartmentList().subscribe({
      next: (list: DepartmentListItem[]) => {
        this.departments = list ?? [];
        this.departmentsLoading = false;
      },
      error: () => {
        this.departments = [];
        this.departmentsLoading = false;
        this.departmentsError = 'Could not load departments';
      }
    });
  }

  get recordStatus(): string | null {
    return this.loaded?.recstatus ?? null;
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

  private buildPayload(): UserRequest {
    const raw = this.userForm.getRawValue();
    return {
      loginid: raw.loginid,
      password: raw.password,
      username: raw.username,
      userstatus: raw.userstatus,
      usercat: raw.usercat,
      authtype: 'LOCAL',
      departmentcode: raw.departmentcode,
      contactno: raw.contactno,
      emailid: raw.emailid,
      mailingaddress: raw.mailingaddress,
      employeeid: raw.employeeid,
      appuser: sessionStorage.getItem('loggedInUserId')
    };
  }

  private run(
    call: (payload: UserRequest) => ReturnType<ApiService['saveUser']>,
    successMessage: string
  ): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.busy = true;
    this.resultMessage = '';
    this.errorMessage = '';

    call.call(this.api, this.buildPayload()).subscribe({
      next: (record) => {
        this.busy = false;
        this.loaded = record;
        this.userForm.get('loginid')?.disable();
        this.resultMessage = successMessage;
        if (this.isApproved) {
          this.userForm.disable();
        }
      },
      error: (err) => {
        this.busy = false;
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Request failed';
      }
    });
  }

  onSave(): void {
    this.run(this.api.saveUser, 'User saved. Submit it for authorization when ready.');
  }

  onUpdate(): void {
    this.run(this.api.updateUser, 'User updated.');
  }

  onSubmit(): void {
    this.run(this.api.submitUser, 'Submitted for authorization.');
  }

  onApprove(): void {
    this.run(this.api.approveUser, 'User approved.');
  }

  onReject(): void {
    this.run(this.api.rejectUser, 'User rejected.');
  }

  onReset(): void {
    this.userForm.reset({
      loginid: '',
      password: '',
      username: '',
      userstatus: 'A',
      usercat: 'U',
      departmentcode: '',
      contactno: '',
      emailid: '',
      mailingaddress: '',
      employeeid: ''
    });
    this.userForm.enable();
    this.loaded = null;
    this.resultMessage = '';
    this.errorMessage = '';
  }

  onBack(): void {
    this.router.navigate(['/adminPanel/UserInquiries']);
  }
}
