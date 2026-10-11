import { isDevMode } from '@angular/core';

/**
 * Diagnostics that stay out of a production console.
 *
 * This exists because `ApiService.postData` used to log its whole request
 * body, and login goes through that method - so a login id and a plaintext
 * password were written to the browser console on every sign-in, where any
 * console-capturing extension or shared screen could pick them up.
 *
 * `debug` is dropped entirely in a production build. `warn` and `error` are
 * always kept, because losing a real failure is worse than the noise.
 */
export const logger = {
  debug(message: string, ...details: unknown[]): void {
    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.log(message, ...details);
    }
  },

  warn(message: string, ...details: unknown[]): void {
    console.warn(message, ...details);
  },

  error(message: string, ...details: unknown[]): void {
    console.error(message, ...details);
  },
};

/**
 * Names that must never be written to a log, in any environment.
 * Matched case-insensitively against object keys.
 */
const SECRET_KEYS =
  /^(password|passwd|pwd|newpassword|confirmpassword|token|jwttoken|accesstoken|refreshtoken|authorization|apikey|secret)$/i;

/**
 * Copies an object with secret-looking values masked, for the rare case where
 * a payload genuinely has to be logged while debugging. Prefer logging a field
 * count or an id instead of calling this.
 */
export function redact(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
      SECRET_KEYS.test(key) ? [key, '[redacted]'] : [key, redact(entry)],
    ),
  );
}
