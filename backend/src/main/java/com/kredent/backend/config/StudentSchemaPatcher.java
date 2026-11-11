package com.kredent.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

/**
 * Students used to have a platform-wide UNIQUE constraint on {@code usn}. With several colleges on the
 * platform a USN only has to be unique <em>within</em> a college (the new unique key is
 * {@code (institution_id, usn)}). Hibernate's {@code ddl-auto=update} adds the new key but never drops the
 * old one, so on an existing PostgreSQL / Supabase database two colleges could still not share a USN.
 *
 * This runner drops any single-column UNIQUE constraint on {@code students.usn}. It is idempotent, touches
 * nothing else, does nothing on other databases, and only logs a warning if it fails.
 */
@Component
@Order(0)
public class StudentSchemaPatcher implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StudentSchemaPatcher.class);

    static final String FIND_LEGACY_USN_UNIQUE = """
            SELECT c.conname
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
             WHERE t.relname = 'students'
               AND c.contype = 'u'
               AND array_length(c.conkey, 1) = 1
               AND (SELECT a.attname FROM pg_attribute a
                     WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1]) = 'usn'
            """;

    private final DataSource dataSource;

    public StudentSchemaPatcher(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!isPostgres()) {
                return;
            }
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            List<String> legacy = jdbc.queryForList(FIND_LEGACY_USN_UNIQUE, String.class);
            for (String name : legacy) {
                jdbc.execute("ALTER TABLE students DROP CONSTRAINT \"" + name.replace("\"", "\"\"") + "\"");
                log.info("Dropped legacy platform-wide unique constraint on students.usn ({}); USNs are now unique per institution.", name);
            }
        } catch (Exception e) {
            log.warn("Could not check the legacy students.usn constraint ({}). If two colleges cannot share a USN, "
                    + "run docs/multi-institution-migration.sql.", e.getClass().getSimpleName());
        }
    }

    private boolean isPostgres() throws SQLException {
        try (Connection c = dataSource.getConnection()) {
            return "PostgreSQL".equalsIgnoreCase(c.getMetaData().getDatabaseProductName());
        }
    }
}
