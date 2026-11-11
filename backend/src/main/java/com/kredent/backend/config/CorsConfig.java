package com.kredent.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Single source of truth for CORS. CORS_ALLOWED_ORIGINS is an optional, comma-separated list of
 * extra allowed origins on top of the two default localhost origins — e.g. the deployed Azure
 * Static Web Apps frontend URL in production. The two localhost origins are always included, so
 * local development is unaffected either way, and the production frontend URL never has to be
 * hardcoded into source or changed via a redeploy — just set the env var.
 */
@Configuration
public class CorsConfig {

    private static final List<String> DEFAULT_ORIGINS = List.of(
            "http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175");

    @Bean
    public CorsFilter corsFilter(@Value("${cors.allowed-origins:}") String extraOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(resolveAllowedOrigins(extraOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }

    /** Always includes the default local dev origins (Vite moves to 5174/5175 when 5173 is busy), plus any extra ones from CORS_ALLOWED_ORIGINS (comma-separated, blank/duplicate entries ignored). */
    private static List<String> resolveAllowedOrigins(String extraOrigins) {
        if (extraOrigins == null || extraOrigins.isBlank()) {
            return DEFAULT_ORIGINS;
        }
        List<String> combined = new ArrayList<>(DEFAULT_ORIGINS);
        Arrays.stream(extraOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty() && !combined.contains(origin))
                .forEach(combined::add);
        return combined;
    }
}
