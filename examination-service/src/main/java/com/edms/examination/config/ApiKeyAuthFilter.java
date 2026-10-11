package com.edms.examination.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Rejects any request that does not carry the shared API key.
 *
 * Deliberately a plain servlet filter rather than spring-boot-starter-security:
 * the service already configures CORS through WebMvcConfigurer, and dropping a
 * full security filter chain in front of that would change CORS preflight
 * handling as a side effect. This does one job and leaves everything else as it
 * was.
 */
@Component
@Order(1)
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyAuthFilter.class);
    static final String HEADER = "X-API-Key";

    private final SecurityProperties security;

    public ApiKeyAuthFilter(SecurityProperties security) {
        this.security = security;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!security.isEnabled()) {
            return true;
        }
        // A CORS preflight never carries custom headers, so requiring the key
        // here would break the browser before the real request is sent. The
        // real request that follows is still checked.
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        for (String open : security.getOpenPaths()) {
            if (path.equals(open)) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        if (matches(request.getHeader(HEADER), security.getApiKey())) {
            chain.doFilter(request, response);
            return;
        }

        // The key itself is never echoed, and neither is the value that was
        // sent - only that the attempt happened, and from where.
        log.warn("Rejected {} {} from {}: missing or invalid {}.",
            request.getMethod(), request.getRequestURI(), request.getRemoteAddr(), HEADER);

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader(HttpHeaders.WWW_AUTHENTICATE, HEADER);
        response.getWriter().write("""
            {"error":"Unauthorized","detail":"A valid X-API-Key header is required."}""");
    }

    /**
     * Constant-time comparison. A plain String.equals returns as soon as two
     * bytes differ, and that timing difference can be measured to recover a
     * secret one character at a time.
     */
    private static boolean matches(String presented, String expected) {
        if (presented == null) {
            return false;
        }
        return MessageDigest.isEqual(
            presented.getBytes(StandardCharsets.UTF_8),
            expected.getBytes(StandardCharsets.UTF_8));
    }
}
