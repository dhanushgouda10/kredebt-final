package com.kredent.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kredent.backend.exception.ApiException;
import com.kredent.backend.service.InstitutionAccessService;
import com.kredent.backend.util.SecurityConstants;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Keeps unverified or suspended institutions out of the college-administrator API.
 *
 * Runs right after JWT authentication. For any authenticated ADMIN request under /api/admin/ it
 * requires the token to carry an institution and re-checks, against the database and the registry,
 * that the institution is verified, has a linked wallet and is still APPROVED. A token alone is
 * never enough — suspending an institution in the registry locks its administrators out on their
 * next request.
 */
@Component
public class AdminInstitutionGuardFilter extends OncePerRequestFilter {

    private static final String ADMIN_API_PREFIX = "/api/admin/";

    private final InstitutionAccessService institutionAccessService;
    private final ObjectMapper objectMapper;

    public AdminInstitutionGuardFilter(InstitutionAccessService institutionAccessService, ObjectMapper objectMapper) {
        this.institutionAccessService = institutionAccessService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (request.getRequestURI().startsWith(ADMIN_API_PREFIX) && isAdmin(auth)) {
            Object institutionId = request.getAttribute(SecurityConstants.INSTITUTION_ID_ATTRIBUTE);
            if (!(institutionId instanceof Long id)) {
                reject(response, 403, "INSTITUTION_REQUIRED",
                        "Sign in again with your institutional ID to access the administrator dashboard.");
                return;
            }
            try {
                institutionAccessService.requireActiveById(id);
            } catch (ApiException e) {
                reject(response, e.getStatus().value(), e.getCode(), e.getMessage());
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> (SecurityConstants.ROLE_PREFIX + "ADMIN").equals(a.getAuthority()));
    }

    private void reject(HttpServletResponse response, int status, String code, String message) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status);
        body.put("code", code);
        body.put("message", message);
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
