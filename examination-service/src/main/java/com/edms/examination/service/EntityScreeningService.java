package com.edms.examination.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

/**
 * Real entity-name screening against OpenSanctions' /match endpoint -
 * proper scored fuzzy matching, not the substring check that produced the
 * "Miranda Shipping" false positive in the original frontend prototype.
 *
 * Unlike the country list, this has no realistic "local" offline mode at
 * this data scale (the full watchlist dataset is gigabytes) - a bank
 * network with no internet access needs OpenSanctions' bulk data export
 * imported separately, not this live-call path. That's a different,
 * larger problem than what's built here.
 *
 * 50 requests/month on the trial tier - callers should not use this for
 * anything but deliberate, one-off checks until upgraded.
 */
@Service
public class EntityScreeningService {

    private final RestTemplate restTemplate;

    @Value("${opensanctions.api.url}")
    private String apiUrl;

    @Value("${opensanctions.api.key:}")
    private String apiKey;

    public EntityScreeningService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * @param name   the extracted name to screen
     * @param schema "Person" or "Company" (or "Organization", "LegalEntity" -
     *               any Follow The Money entity schema OpenSanctions accepts)
     *
     * Response shape confirmed against a real, live API call on 2026-09-04
     * (query "Aleksandr Zacharov" -> correctly matched a real EU/UK/UA
     * sanctioned individual, score 0.92, despite the spelling variant) -
     * not written from documentation alone.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> checkEntity(String name, String schema) {
        if (!isConfigured()) {
            return Map.of(
                "checked", name,
                "screened", false,
                "error", "OPENSANCTIONS_API_KEY not configured - no check performed"
            );
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "ApiKey " + apiKey);
        headers.set("Content-Type", "application/json");

        Map<String, Object> requestBody = Map.of(
            "queries", Map.of(
                "q", Map.of(
                    "schema", schema,
                    "properties", Map.of("name", List.of(name))
                )
            )
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Map> response = restTemplate.exchange(
            apiUrl + "/match/default", HttpMethod.POST, request, Map.class
        );

        Map<String, Object> body = response.getBody();
        if (body == null) {
            return Map.of("checked", name, "screened", true, "hasMatch", false, "candidates", List.of());
        }

        Map<String, Object> responses = (Map<String, Object>) body.get("responses");
        Map<String, Object> q = responses != null ? (Map<String, Object>) responses.get("q") : null;
        List<Map<String, Object>> results = q != null
            ? (List<Map<String, Object>>) q.getOrDefault("results", List.of())
            : List.of();

        List<Map<String, Object>> candidates = results.stream()
            .map(r -> {
                // topics lives under properties, not at the top level of the
                // result - confirmed against a real response, not assumed.
                Map<String, Object> properties = (Map<String, Object>) r.get("properties");
                Object topics = properties != null ? properties.get("topics") : null;

                Map<String, Object> candidate = new java.util.LinkedHashMap<>();
                candidate.put("id", r.get("id"));
                candidate.put("name", r.get("caption"));
                candidate.put("score", r.get("score"));
                candidate.put("isMatch", r.get("match")); // OpenSanctions' own calibrated threshold - not one we invented
                candidate.put("topics", topics);
                candidate.put("datasets", r.get("datasets"));
                return candidate;
            })
            .toList();

        boolean hasMatch = candidates.stream()
            .anyMatch(c -> Boolean.TRUE.equals(c.get("isMatch")));

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("checked", name);
        result.put("schema", schema);
        result.put("screened", true);
        result.put("hasMatch", hasMatch);
        result.put("candidates", candidates);
        return result;
    }
}
