package com.kredent.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Component
public class JwtService {

    private final SecretKey signingKey;
    private final long expirationMs;

    public JwtService(
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    /**
     * @param subject typically the user's email (students) or wallet address (admins)
     * @param role    "STUDENT" or "ADMIN" — read by JwtAuthFilter to build the Spring authority
     */
    public String generateToken(String subject, String role, Long userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(subject)
                .claims(Map.of("role", role, "userId", userId))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /**
     * College-administrator token: same as above plus the Kredent institution the session belongs
     * to. The claim only says which institution the admin signed in for — every admin request is
     * re-checked against the institution's live status (see AdminInstitutionGuardFilter).
     */
    public String generateToken(String subject, String role, Long userId, Long institutionId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(subject)
                .claims(Map.of("role", role, "userId", userId, "institutionId", institutionId))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(signingKey)
                .compact();
    }

    /** The institution this token was issued for, or null for tokens that carry none (students). */
    public Long extractInstitutionId(String token) {
        Object value = parseClaims(token).get("institutionId");
        return value instanceof Number number ? number.longValue() : null;
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public boolean isValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    public String extractSubject(String token) {
        return parseClaims(token).getSubject();
    }

    public String extractRole(String token) {
        return parseClaims(token).get("role", String.class);
    }
}
