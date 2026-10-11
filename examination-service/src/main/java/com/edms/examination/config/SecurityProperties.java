package com.edms.examination.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * How this service decides whether to answer a request.
 *
 * The service holds every stored analysis, every discrepancy report and the
 * sanctions tables, and the sanctions CSV import is a POST. Before this existed
 * anything that could reach port 8090 could read all of it and rewrite the
 * country risk list.
 *
 * The key is meant for the caller in front of the service - the dev proxy, the
 * production reverse proxy, or the ingest service - never for browser code. An
 * API key compiled into an Angular bundle is readable by anyone with developer
 * tools open, so it protects nothing.
 */
@Component
@ConfigurationProperties(prefix = "security")
public class SecurityProperties {

    private static final Logger log = LoggerFactory.getLogger(SecurityProperties.class);

    /**
     * Shared secret expected in the X-API-Key header. Empty disables the check,
     * which is only safe while the service is bound to localhost.
     */
    private String apiKey = "";

    /**
     * Paths answered without a key, for container and uptime checks.
     *
     * Empty by default because this service has no actuator on the classpath,
     * so there is no health endpoint to leave open. A 401 from the port is
     * itself proof that the process is alive and answering, which is enough for
     * a liveness probe. Set security.open-paths if a health endpoint is added.
     */
    private String[] openPaths = {};

    @PostConstruct
    void warnIfUnprotected() {
        if (apiKey.isBlank()) {
            log.warn("""

                ****************************************************************
                security.api-key is not set, so every endpoint on this service
                is open to anything that can reach this port. That is acceptable
                only because server.address binds to localhost by default.

                Before exposing this service on a network interface, set
                EXAMINATION_API_KEY and have the reverse proxy in front of it
                send the same value in the X-API-Key header.
                ****************************************************************
                """);
        } else {
            log.info("API key authentication is enabled ({} paths open).", openPaths.length);
        }
    }

    public boolean isEnabled() {
        return !apiKey.isBlank();
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public String[] getOpenPaths() {
        return openPaths;
    }

    public void setOpenPaths(String[] openPaths) {
        this.openPaths = openPaths;
    }
}
