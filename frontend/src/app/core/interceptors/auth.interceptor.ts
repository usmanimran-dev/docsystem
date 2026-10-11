import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { clearSession, getToken } from '../auth/auth-storage';

/**
 * Attaches the JWT to outgoing requests as `Authorization: Bearer <token>`,
 * and sends the user back to the login screen if the backend rejects it.
 *
 * The login call is skipped: there is no token yet at that point.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = getToken();
  const isLoginRequest = req.url.includes('/login');

  // environment.attachAuthToken is a temporary demo switch - see the note there.
  const request =
    environment.attachAuthToken && token && !isLoginRequest
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 = token missing/expired → clear state and force re-login.
      // 403 = authenticated but access denied → surface the error in the UI
      //       so the user sees what went wrong instead of being silently
      //       logged out (e.g. a role check failing on /dms/save).
      if (err.status === 401 && !isLoginRequest) {
        clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
