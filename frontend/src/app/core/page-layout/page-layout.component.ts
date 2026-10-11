import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from "../topbar/topbar";
import { Sidebar } from "../sidebar/sidebar";
import { AuthService } from '../services/auth.service';
interface MenuItem {
  label: string;
  icon?: string;
  route?: string;
  open?: boolean;
  children?: MenuItem[];
}
@Component({
  selector: 'app-page-layout',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, RouterOutlet, TopbarComponent, Sidebar],
  templateUrl: './page-layout.component.html',
  styleUrls: ['./page-layout.component.scss']
})
export class PageLayoutComponent {
  collapsed = false;

  // ================= USER MENU =================

  userMenu: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'home',
      route: '/userPanel'
    },
    {
      label: 'Documents',
      icon: 'description',
      open: false,
      children: [
        { label: 'Search By Doc ID', route: '/userPanel/SearchDoc' },
        { label: 'Search By Ref ID', route: '/userPanel/SearchRef' },
        { label: 'Pending Documents', route: '/userPanel/PendingDocuments' },
        { label: 'Submitted Documents', route: '/userPanel/SubmittedDocuments' },
        { label: 'Approved Documents', route: '/userPanel/ApprovedDocuments' }
      ]
    },
    {
      label: 'Document Reader',
      icon: 'document_scanner',
      route: '/userPanel/DocumentReader'
    },
    {
      label: 'Discrepancy Check',
      icon: 'compare_arrows',
      route: '/userPanel/DiscrepancyCheck'
    },
    {
      label: 'Logout',
      icon: 'logout'
    }
  ];

  // ================= ADMIN MENU =================
  adminMenu: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/adminPanel'
    },
    {
      label: 'Product',
      icon: 'shopping_cart',
      open: false,
      children:[
        { label: 'Create Product', route: '/adminPanel/CreateProduct' },
      ]
    },
    {
      label: 'Users',
      icon: 'people',
      open: false,
      children: [
        { label: 'Create User', route: '/adminPanel/CreateUser' },
        { label: 'Inquiries', route: '/adminPanel/UserInquiries' },
      ]
    },
    {
      label: 'Department',
      icon: 'apartment',
      open: false,
      children: [
        { label: 'Create Department', route: '/adminPanel/CreateDepartment' },
        { label: 'Inquiries', route: '/adminPanel/DepartmentInquiries' },
      ]
    },
    {
      label: 'Document Type',
      icon: 'category',
      open: false,
      children: [
        { label: 'Create Document Type', route: '/adminPanel/CreateDocumentType' },
        { label: 'Inquiries', route: '/adminPanel/DocumentTypeInquiries' },
      ]
    },
    {
      label: 'Compliance Data',
      icon: 'policy',
      route: '/adminPanel/ComplianceData'
    },
    {
      label: 'Logout',
      icon: 'logout'
    }
  ];

  constructor(private auth: AuthService) { }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
  }

  activeMenu(): MenuItem[] {
    return this.auth.getUserCategory() === 'ADMIN' ? this.adminMenu : this.userMenu;
  }
}