import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  UserRole,
  clearSession,
  getToken,
  getUserRole,
  storeSession
} from '../auth/auth-storage';

/** Signs the user in and out. The storage itself lives in auth-storage.ts. */
@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private api: ApiService, private router: Router) {}

  login(loginid: string, password: string): Observable<any> {
    return this.api.postData('login', { loginid, password }).pipe(
      tap(res => {
        if (!res?.jwtToken) {
          return;
        }
        // The backend sends usercat as a single letter ("A" admin, "U" user).
        // Store the mapped role so it matches the `role` on the route data.
        const role: UserRole = res.usercat === 'A' ? 'ADMIN' : 'USER';
        storeSession(res.jwtToken, role);
      })
    );
  }

  logout(): void {
    clearSession();
    this.router.navigate(['/login']);
  }

  checkAuth(): boolean {
    return !!getToken();
  }

  getToken(): string | null {
    return getToken();
  }

  getUserCategory(): UserRole | null {
    return getUserRole();
  }
}
