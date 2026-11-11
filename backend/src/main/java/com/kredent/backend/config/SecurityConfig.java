package com.kredent.backend.config;

import com.kredent.backend.security.AdminInstitutionGuardFilter;
import com.kredent.backend.security.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    // The guard filter is a method parameter, NOT a constructor dependency of this class: it needs the
    // PasswordEncoder bean declared above (via the registry service), so constructor-injecting it would
    // create a SecurityConfig <-> PasswordEncoder circular dependency that Spring Boot refuses to start with.
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   AdminInstitutionGuardFilter adminInstitutionGuardFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/verify/**").permitAll()
                        // Swagger's own docs/UI, not an API route — without this the docs page
                        // can't load at all (chicken-and-egg: you'd need a JWT to view how to get one).
                        // This does not loosen access to any actual /api/** business endpoint.
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // Simulated institutional registry (demo only). Registration, email
                        // verification and the registry admin's own login are public; everything
                        // else under /api/registry/admin needs the separate registry-admin role.
                        .requestMatchers("/api/registry/admin/login").permitAll()
                        .requestMatchers("/api/registry/admin/**").hasRole("REGISTRY_ADMIN")
                        .requestMatchers("/api/registry/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/student/**").hasRole("STUDENT")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(adminInstitutionGuardFilter, JwtAuthFilter.class);

        return http.build();
    }
}
