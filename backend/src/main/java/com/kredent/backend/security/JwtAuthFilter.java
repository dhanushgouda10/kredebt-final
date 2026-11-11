package com.kredent.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.kredent.backend.util.SecurityConstants;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader(SecurityConstants.AUTH_HEADER);

        if (header != null && header.startsWith(SecurityConstants.TOKEN_PREFIX)) {
            String token = header.substring(SecurityConstants.TOKEN_PREFIX.length());

            if (jwtService.isValid(token) && SecurityContextHolder.getContext().getAuthentication() == null) {
                String subject = jwtService.extractSubject(token);
                String role = jwtService.extractRole(token);

                var authorities = List.of(new SimpleGrantedAuthority(SecurityConstants.ROLE_PREFIX + role));
                var authToken = new UsernamePasswordAuthenticationToken(subject, null, authorities);
                authToken.setDetails(request.getRemoteAddr());

                Long institutionId = jwtService.extractInstitutionId(token);
                if (institutionId != null) {
                    request.setAttribute(SecurityConstants.INSTITUTION_ID_ATTRIBUTE, institutionId);
                }
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
