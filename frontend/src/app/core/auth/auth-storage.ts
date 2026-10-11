/**
 * Where the signed-in user's details are kept, and how to clear them.
 *
 * This is a plain module rather than a service because the HTTP interceptor
 * needs it too, and injecting AuthService there would be a dependency cycle:
 * AuthService -> ApiService -> HttpClient -> interceptor.
 */

export const TOKEN_KEY = 'auth_token';
export const ROLE_KEY = 'usercat';

export type UserRole = 'USER' | 'ADMIN';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUserRole(): UserRole | null {
  return localStorage.getItem(ROLE_KEY) as UserRole | null;
}

export function storeSession(token: string, role: UserRole): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

/**
 * Clears both stores. The token is in localStorage but the login screen also
 * puts the user id and name in sessionStorage — clearing only one of them left
 * the user effectively still signed in.
 */
export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  sessionStorage.clear();
}
