/**
 * Dev-server proxy.
 *
 * This replaced proxy.conf.json so that the examination service's API key can
 * be injected here, on the Node side of the dev server, instead of being
 * compiled into the Angular bundle. A key that ships to the browser is not a
 * secret - anyone can read it out of the network tab - so the header is added
 * by whatever sits in front of the service: this file in development, and the
 * reverse proxy in production.
 *
 * Leave EXAMINATION_API_KEY unset for normal local work. The service then runs
 * with its key check disabled and is reachable on loopback only. Set it here
 * and in the service's environment together, or neither.
 */

const examineHeaders = {};
if (process.env.EXAMINATION_API_KEY) {
  examineHeaders['X-API-Key'] = process.env.EXAMINATION_API_KEY;
}

module.exports = {
  '/api': {
    target: 'http://localhost:8082',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
  },
  '/examine': {
    target: 'http://localhost:8090',
    secure: false,
    changeOrigin: true,
    pathRewrite: { '^/examine': '' },
    headers: examineHeaders,
  },
};
