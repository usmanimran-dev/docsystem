import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.checkAuth()) {
    router.navigate(['/login']);
    return false;
  }

  const requiredRole = route.data['role'] as 'USER' | 'ADMIN' | undefined;
  const userRole = auth.getUserCategory();

  if (requiredRole && userRole !== requiredRole) {
    // Logged in, but this route belongs to the other role — send them to
    // their own dashboard rather than leaving them on a blank screen.
    router.navigate([userRole === 'ADMIN' ? '/adminPanel' : '/userPanel']);
    return false;
  }

  return true;
};
