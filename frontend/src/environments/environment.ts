export const environment = {
    production: false,
    // Same-origin prefixes, forwarded to their respective backends by
    // proxy.conf.json (which strips the prefix). The backends send no CORS
    // headers, so direct cross-origin calls fail; the prefixes also keep
    // API paths from colliding with app routes such as /login.
    //
    //   /api      -> dmsclientext        (Imad's DMS backend, port 8082)
    //   /examine  -> examination-service (OCR/analysis, port 8090)
    apiUrl: '/api',
    productApiUrl: '/api',
    examineApiUrl: '/examine',

    // TEMPORARY (demo, 2026-09-19): the permit-all dmsclientext JAR runs the
    // request chain twice whenever an Authorization header is present
    // (JwtAuthenticationFilter calls chain.doFilter with no return), so every
    // GET body comes back doubled and HttpClient fails to parse it. The
    // backend ignores auth right now anyway, so don't send the token.
    // Set back to true once Imad ships the fixed JAR.
    attachAuthToken: false
};
