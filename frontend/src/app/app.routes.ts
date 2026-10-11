import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { PageLayoutComponent } from './core/page-layout/page-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/AUTH/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./pages/AUTH/signup/signup.component').then(m => m.SignupComponent),
  },
  {
    path: '',
    component: PageLayoutComponent,
    // Guards every screen inside the layout: without a token the guard
    // redirects to /login.
    canActivate: [authGuard],
    children: [
      {
        path: 'adminPanel',
        canActivate: [authGuard],
        data: { role: 'ADMIN' }, // only ADMIN
        loadComponent: () =>
          import('./pages/ADMIN/admin-dashboard/admin-dashboard.component').then(
            m => m.AdminDashboardComponent
          ),
      },
      {
        path: "adminPanel/CreateProduct",
        loadComponent: () =>
          import("./pages/ADMIN/create-product/create-product.component")
            .then((m) => m.CreateProductComponent),
      },
      {
        path: "adminPanel/CreateUser",
        loadComponent: () =>
          import("./pages/ADMIN/create-user/create-user.component")
            .then((m) => m.CreateUserComponent),
      },
      {
        path: 'adminPanel/UserInquiries',
        loadComponent: () =>
          import(
            './pages/ADMIN/user-inquiries/user-inquiries.component'
          ).then((m) => m.UserInquiriesComponent),
      },
      {
        path: 'adminPanel/CreateDepartment',
        loadComponent: () =>
          import(
            './pages/ADMIN/create-department/create-department.component'
          ).then((m) => m.CreateDepartmentComponent),
      },
      {
        path: 'adminPanel/DepartmentInquiries',
        loadComponent: () =>
          import(
            './pages/ADMIN/department-inquiries/department-inquiries.component'
          ).then((m) => m.DepartmentInquiriesComponent),
      },
      {
        path: 'adminPanel/CreateDocumentType',
        loadComponent: () =>
          import(
            './pages/ADMIN/create-document-type/create-document-type.component'
          ).then((m) => m.CreateDocumentTypeComponent),
      },
      {
        path: 'adminPanel/DocumentTypeInquiries',
        loadComponent: () =>
          import(
            './pages/ADMIN/document-type-inquiries/document-type-inquiries.component'
          ).then((m) => m.DocumentTypeInquiriesComponent),
      },
      {
        path: 'adminPanel/InquiryRecords',
        loadComponent: () =>
          import(
            './pages/ADMIN/inquiry-records/inquiry-records.component'
          ).then((m) => m.InquiryRecordsComponent),
      },
      {
        path: 'adminPanel/ComplianceData',
        loadComponent: () =>
          import(
            './pages/ADMIN/compliance-data/compliance-data.component'
          ).then((m) => m.ComplianceDataComponent),
      },
      {
        path: 'userPanel',
        canActivate: [authGuard],
        data: { role: 'USER' }, // only USER
        loadComponent: () =>
          import('./pages/USER/user-dashboard/user-dashboard.component').then(
            m => m.UserDashboardComponent
          ),
      },
      {
        path: 'userPanel/SearchDoc',
        loadComponent: () =>
          import('./pages/USER/search-doc/search-doc.component').then(
            m => m.SearchDocComponent
          ),
      },
      // One screen serves all three stages; `stage` picks the endpoint.
      {
        path: 'userPanel/PendingDocuments',
        data: { stage: 'pending' },
        loadComponent: () =>
          import('./pages/USER/document-status/document-status.component').then(
            m => m.DocumentStatusComponent
          ),
      },
      {
        path: 'userPanel/SubmittedDocuments',
        data: { stage: 'submitted' },
        loadComponent: () =>
          import('./pages/USER/document-status/document-status.component').then(
            m => m.DocumentStatusComponent
          ),
      },
      {
        path: 'userPanel/ApprovedDocuments',
        data: { stage: 'approved' },
        loadComponent: () =>
          import('./pages/USER/document-status/document-status.component').then(
            m => m.DocumentStatusComponent
          ),
      },
      {
        path: 'userPanel/SearchRef',
        loadComponent: () =>
          import('./pages/USER/search-ref/search-ref.component').then(
            m => m.SearchRefComponent
          ),
      },
      {
        path: 'userPanel/DocumentReader',
        canActivate: [authGuard],
        data: { role: 'USER' },
        loadComponent: () =>
          import(
            './pages/ADMIN/document-scanner/document-scanner.component'
          ).then((m) => m.DocumentScannerComponent),
      },
      {
        path: 'userPanel/DiscrepancyCheck',
        canActivate: [authGuard],
        data: { role: 'USER' },
        loadComponent: () =>
          import(
            './pages/USER/discrepancy-check/discrepancy-check.component'
          ).then((m) => m.DiscrepancyCheckComponent),
      },
    ],
  },
];
