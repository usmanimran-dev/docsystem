import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginid = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(private router: Router, private auth: AuthService) { }

  onLogin() {
    if (!this.loginid || !this.password) {
      this.errorMessage = 'Login ID and password are required';
      return;
    }

    this.errorMessage = '';
    this.loading = true;

    this.auth.login(this.loginid, this.password).subscribe({
      next: (res) => {
        this.loading = false;

        if (!res?.jwtToken) {
          this.errorMessage = res?.loginstatus || res?.strmsg || 'Invalid credentials';
          return;
        }

        // AuthService.login has already stored the token and mapped usercat
        // to a role, so read it back rather than mapping it a second time.
        const role = this.auth.getUserCategory();

        // userid is the backend login id, and is what the audit fields
        // (inputterid / authorizerid) are recorded against.
        sessionStorage.setItem('loggedInUserId', res.userid || this.loginid);
        sessionStorage.setItem('username', res.username || '');

        this.router.navigate([role === 'ADMIN' ? '/adminPanel' : '/userPanel']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.status === 0
            ? 'Cannot reach the server. Is the backend running on port 8082?'
            : err?.error?.message || err?.error?.loginstatus || 'Login failed';
      },
    });
  }
}
