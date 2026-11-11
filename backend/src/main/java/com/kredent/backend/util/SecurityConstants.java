package com.kredent.backend.util;

/**
 * Shared constants for the JWT auth flow, kept in one place instead of as
 * magic strings scattered across the security filter/config classes.
 */
public final class SecurityConstants {

    public static final String AUTH_HEADER = "Authorization";
    public static final String TOKEN_PREFIX = "Bearer ";
    public static final String ROLE_PREFIX = "ROLE_";

    /** Role carried by the simulated-registry administrator's token (separate from Kredent's ADMIN). */
    public static final String ROLE_REGISTRY_ADMIN = "REGISTRY_ADMIN";

    /** Request attribute JwtAuthFilter sets from the token's institutionId claim (college admins only). */
    public static final String INSTITUTION_ID_ATTRIBUTE = "kredent.institutionId";

    private SecurityConstants() {
        // no instances
    }
}
