import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { DepartmentRecord, RECORD_STATUS } from '../../../core/models/department.model';

@Component({
  selector: 'app-department-inquiries',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './department-inquiries.component.html',
  styleUrls: ['./department-inquiries.component.scss']
})
export class DepartmentInquiriesComponent implements OnInit {

  searchQuery = '';
  activeTab: string = RECORD_STATUS.SAVED;
  loading = false;
  errorMessage = '';

  // Each tab is its own endpoint, not a client-side filter.
  tabs = [
    { key: RECORD_STATUS.SAVED, label: 'Pending' },
    { key: RECORD_STATUS.SUBMITTED, label: 'Submitted' },
    { key: RECORD_STATUS.APPROVED, label: 'Approved' }
  ];

  allDepartments: DepartmentRecord[] = [];
  filteredDepartments: DepartmentRecord[] = [];

  currentPage = 1;
  itemsPerPage = 10;

  sortColumn: keyof DepartmentRecord | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.loading = true;
    this.errorMessage = '';

    let request: Observable<DepartmentRecord[]>;
    if (this.activeTab === RECORD_STATUS.SUBMITTED) {
      request = this.api.getSubmittedDepartments();
    } else if (this.activeTab === RECORD_STATUS.APPROVED) {
      request = this.api.getApprovedDepartments();
    } else {
      request = this.api.getPendingDepartments();
    }

    request.subscribe({
      next: (records) => {
        this.loading = false;
        this.allDepartments = records ?? [];
        this.applyFilters();
      },
      error: (err) => {
        this.loading = false;
        this.allDepartments = [];
        this.filteredDepartments = [];
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Could not load departments';
      }
    });
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredDepartments = this.allDepartments.filter(d =>
      !q ||
      (d.departmentcode ?? '').toLowerCase().includes(q) ||
      (d.departmentname ?? '').toLowerCase().includes(q)
    );

    this.sortData();
    this.currentPage = 1;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.loadDepartments();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  sortBy(column: keyof DepartmentRecord): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.sortData();
  }

  sortData(): void {
    if (!this.sortColumn) return;

    this.filteredDepartments.sort((a, b) => {
      const valA = String(a[this.sortColumn!] ?? '');
      const valB = String(b[this.sortColumn!] ?? '');
      return this.sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDepartments.length / this.itemsPerPage));
  }

  get pagedDepartments(): DepartmentRecord[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDepartments.slice(start, start + this.itemsPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  statusLabel(recordstatus: string): string {
    if (recordstatus === RECORD_STATUS.SUBMITTED) return 'Submitted';
    if (recordstatus === RECORD_STATUS.APPROVED) return 'Approved';
    return 'Pending';
  }

  openDepartment(dept: DepartmentRecord): void {
    this.router.navigate(['/adminPanel/CreateDepartment'], { state: { record: dept } });
  }

  trackByCode(_: number, dept: DepartmentRecord): string {
    return dept.departmentcode;
  }
}
