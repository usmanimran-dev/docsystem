// Compiled instead of environment.ts by the production configuration, through
// the fileReplacements entry in angular.json.
//
// Paths stay relative on purpose. A production deployment puts a reverse proxy
// in front of the app that forwards /api to the DMS backend and /examine to the
// examination service, adding the X-API-Key header to the latter. Hard-coding
// an absolute API host here instead would mean the browser calls the backend
// cross-origin, which needs CORS opened up and exposes the backend directly.
// See DEPLOYMENT.md.
export const environment = {
  production: true,
  apiUrl: '/api',
  productApiUrl: '/api',
  examineApiUrl: '/examine',

  // Always true in production. The `false` in environment.ts is a workaround
  // for a bug in the demo build of the DMS JAR, and that workaround must never
  // reach a real deployment: with it off, no Authorization header is sent at
  // all.
  attachAuthToken: true,
};
