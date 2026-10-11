import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { RECORD_STATUS } from '../../../core/models/department.model';
import { UserRecord } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-inquiries',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  templateUrl: './user-inquiries.component.html',
  styleUrls: ['./user-inquiries.component.scss']
})
export class UserInquiriesComponent implements OnInit {

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

  allUsers: UserRecord[] = [];
  filteredUsers: UserRecord[] = [];

  currentPage = 1;
  itemsPerPage = 10;

  sortColumn: keyof UserRecord | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    let request: Observable<UserRecord[]>;
    if (this.activeTab === RECORD_STATUS.SUBMITTED) {
      // The backend hides records this user submitted — they are not allowed
      // to approve their own, so there is no point listing them.
      const loginid = sessionStorage.getItem('loggedInUserId') ?? '';
      request = this.api.getSubmittedUsers(loginid);
    } else if (this.activeTab === RECORD_STATUS.APPROVED) {
      request = this.api.getApprovedUsers();
    } else {
      request = this.api.getPendingUsers();
    }

    request.subscribe({
      next: (records) => {
        this.loading = false;
        this.allUsers = records ?? [];
        this.applyFilters();
      },
      error: (err) => {
        this.loading = false;
        this.allUsers = [];
        this.filteredUsers = [];
        this.errorMessage = err?.error?.message ?? err?.message ?? 'Could not load users';
      }
    });
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();

    this.filteredUsers = this.allUsers.filter(u =>
      !q ||
      (u.loginid ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );

    this.sortData();
    this.currentPage = 1;
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
    this.loadUsers();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  sortBy(column: keyof UserRecord): void {
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

    this.filteredUsers.sort((a, b) => {
      const valA = String(a[this.sortColumn!] ?? '');
      const valB = String(b[this.sortColumn!] ?? '');
      return this.sortDirection === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.itemsPerPage));
  }

  get pagedUsers(): UserRecord[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(start, start + this.itemsPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  statusLabel(recstatus: string): string {
    if (recstatus === RECORD_STATUS.SUBMITTED) return 'Submitted';
    if (recstatus === RECORD_STATUS.APPROVED) return 'Approved';
    return 'Pending';
  }

  categoryLabel(usercat: string): string {
    return usercat === 'A' ? 'Admin' : 'User';
  }

  openUser(user: UserRecord): void {
    this.router.navigate(['/adminPanel/CreateUser'], { state: { record: user } });
  }

  trackByLoginId(_: number, user: UserRecord): string {
    return user.loginid;
  }
}
