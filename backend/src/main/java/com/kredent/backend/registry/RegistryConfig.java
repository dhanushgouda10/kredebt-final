package com.kredent.backend.registry;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.sqlite.SQLiteDataSource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Wires the simulated registry's SQLite file.
 *
 * Deliberately NOT exposed as a DataSource bean: Spring Boot's JPA/PostgreSQL auto-configuration
 * must keep seeing exactly one DataSource (the real Kredent database). The SQLite connection
 * factory lives inside this method and is reachable only through the named JdbcTemplate below, so
 * the registry can never leak into the main persistence layer.
 */
@Configuration
public class RegistryConfig {

    public static final String REGISTRY_JDBC_TEMPLATE = "registryJdbcTemplate";

    @Bean(name = REGISTRY_JDBC_TEMPLATE)
    public JdbcTemplate registryJdbcTemplate(@Value("${registry.db-path:./data/registry.db}") String dbPath) {
        Path file = Paths.get(dbPath).toAbsolutePath();
        try {
            if (file.getParent() != null) {
                Files.createDirectories(file.getParent());
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create the registry database folder: " + file.getParent(), e);
        }

        SQLiteDataSource dataSource = new SQLiteDataSource();
        dataSource.setUrl("jdbc:sqlite:" + file);
        dataSource.setEnforceForeignKeys(true);
        dataSource.setBusyTimeout(5000);
        dataSource.setJournalMode("WAL");
        return new JdbcTemplate(dataSource);
    }
}
