package com.kredent.backend.registry;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * All SQL for the simulated registry (SQLite). Plain JDBC with bound parameters throughout — no
 * string-concatenated SQL anywhere, so user input can never alter a query.
 *
 * Timestamps are stored as ISO-8601 UTC text (Instant.toString()), which sorts correctly as text.
 */
@Repository
public class RegistryRepository {

    /** An email-verification OTP row. */
    public record EmailOtp(long id, long institutionPk, String otpHash, String salt,
                           Instant expiresAt, int attempts, Instant sentAt, Instant consumedAt) {
    }

    public record RegistryAdmin(long id, String email, String passwordHash) {
    }

    public record LogEntry(long id, String institutionId, String event, String detail, Instant createdAt) {
    }

    private final JdbcTemplate jdbc;

    public RegistryRepository(@Qualifier(RegistryConfig.REGISTRY_JDBC_TEMPLATE) JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void createSchema() {
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS registry_institutions (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    institution_id   TEXT NOT NULL UNIQUE,
                    college_name     TEXT NOT NULL,
                    state            TEXT NOT NULL,
                    district         TEXT NOT NULL,
                    hoi_name         TEXT NOT NULL,
                    official_email   TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    contact_number   TEXT NOT NULL,
                    password_hash    TEXT NOT NULL,
                    status           TEXT NOT NULL DEFAULT 'PENDING'
                                     CHECK (status IN ('PENDING','APPROVED','SUSPENDED')),
                    email_verified   INTEGER NOT NULL DEFAULT 0,
                    created_at       TEXT NOT NULL,
                    updated_at       TEXT NOT NULL
                )""");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS registry_email_verification (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    institution_pk  INTEGER NOT NULL
                                    REFERENCES registry_institutions(id) ON DELETE CASCADE,
                    otp_hash        TEXT NOT NULL,
                    salt            TEXT NOT NULL,
                    expires_at      TEXT NOT NULL,
                    attempts        INTEGER NOT NULL DEFAULT 0,
                    sent_at         TEXT NOT NULL,
                    consumed_at     TEXT
                )""");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS registry_admins (
                    id             INTEGER PRIMARY KEY AUTOINCREMENT,
                    email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash  TEXT NOT NULL,
                    created_at     TEXT NOT NULL
                )""");
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS verification_logs (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    institution_id  TEXT,
                    event           TEXT NOT NULL,
                    detail          TEXT,
                    created_at      TEXT NOT NULL
                )""");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_registry_email_otp_inst "
                + "ON registry_email_verification(institution_pk, id)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS idx_verification_logs_created ON verification_logs(id)");
    }

    // ------------------------------------------------------------------ institutions

    private static final RowMapper<RegistryInstitution> INSTITUTION_MAPPER = (rs, rowNum) -> new RegistryInstitution(
            rs.getLong("id"),
            rs.getString("institution_id"),
            rs.getString("college_name"),
            rs.getString("state"),
            rs.getString("district"),
            rs.getString("hoi_name"),
            rs.getString("official_email"),
            rs.getString("contact_number"),
            rs.getString("password_hash"),
            RegistryStatus.valueOf(rs.getString("status")),
            rs.getInt("email_verified") == 1,
            Instant.parse(rs.getString("created_at")));

    public Optional<RegistryInstitution> findByInstitutionId(String institutionId) {
        return queryOne("SELECT * FROM registry_institutions WHERE institution_id = ?", INSTITUTION_MAPPER, institutionId);
    }

    public Optional<RegistryInstitution> findByEmail(String email) {
        return queryOne("SELECT * FROM registry_institutions WHERE official_email = ? COLLATE NOCASE",
                INSTITUTION_MAPPER, email);
    }

    public List<RegistryInstitution> findAll() {
        return jdbc.query("SELECT * FROM registry_institutions ORDER BY created_at DESC, id DESC", INSTITUTION_MAPPER);
    }

    public long count() {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM registry_institutions", Long.class);
        return n == null ? 0 : n;
    }

    public void insert(RegistryInstitution i, boolean emailVerified) {
        String now = Instant.now().toString();
        jdbc.update("""
                        INSERT INTO registry_institutions
                          (institution_id, college_name, state, district, hoi_name, official_email,
                           contact_number, password_hash, status, email_verified, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                i.institutionId(), i.collegeName(), i.state(), i.district(), i.hoiName(), i.officialEmail(),
                i.contactNumber(), i.passwordHash(), i.status().name(), emailVerified ? 1 : 0, now, now);
    }

    public void updateStatus(long pk, RegistryStatus status) {
        jdbc.update("UPDATE registry_institutions SET status = ?, updated_at = ? WHERE id = ?",
                status.name(), Instant.now().toString(), pk);
    }

    public void markEmailVerified(long pk) {
        jdbc.update("UPDATE registry_institutions SET email_verified = 1, updated_at = ? WHERE id = ?",
                Instant.now().toString(), pk);
    }

    // ------------------------------------------------------------------ email OTPs

    private static final RowMapper<EmailOtp> OTP_MAPPER = (rs, rowNum) -> {
        String consumed = rs.getString("consumed_at");
        return new EmailOtp(
                rs.getLong("id"),
                rs.getLong("institution_pk"),
                rs.getString("otp_hash"),
                rs.getString("salt"),
                Instant.parse(rs.getString("expires_at")),
                rs.getInt("attempts"),
                Instant.parse(rs.getString("sent_at")),
                consumed == null ? null : Instant.parse(consumed));
    };

    public Optional<EmailOtp> findLatestOtp(long institutionPk) {
        return queryOne("SELECT * FROM registry_email_verification WHERE institution_pk = ? ORDER BY id DESC LIMIT 1",
                OTP_MAPPER, institutionPk);
    }

    /** Invalidates every outstanding OTP for the institution (a new one is about to be issued). */
    public void consumeAllOtps(long institutionPk) {
        jdbc.update("UPDATE registry_email_verification SET consumed_at = ? WHERE institution_pk = ? AND consumed_at IS NULL",
                Instant.now().toString(), institutionPk);
    }

    public void insertOtp(long institutionPk, String otpHash, String salt, Instant expiresAt) {
        jdbc.update("""
                        INSERT INTO registry_email_verification
                          (institution_pk, otp_hash, salt, expires_at, attempts, sent_at)
                        VALUES (?, ?, ?, ?, 0, ?)""",
                institutionPk, otpHash, salt, expiresAt.toString(), Instant.now().toString());
    }

    public void incrementOtpAttempts(long otpId) {
        jdbc.update("UPDATE registry_email_verification SET attempts = attempts + 1 WHERE id = ?", otpId);
    }

    public void consumeOtp(long otpId) {
        jdbc.update("UPDATE registry_email_verification SET consumed_at = ? WHERE id = ?",
                Instant.now().toString(), otpId);
    }

    // ------------------------------------------------------------------ registry admins

    public Optional<RegistryAdmin> findAdminByEmail(String email) {
        return queryOne("SELECT id, email, password_hash FROM registry_admins WHERE email = ? COLLATE NOCASE",
                (rs, n) -> new RegistryAdmin(rs.getLong("id"), rs.getString("email"), rs.getString("password_hash")),
                email);
    }

    public long countAdmins() {
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM registry_admins", Long.class);
        return n == null ? 0 : n;
    }

    public void updateAdminPassword(long adminId, String passwordHash) {
        jdbc.update("UPDATE registry_admins SET password_hash = ? WHERE id = ?", passwordHash, adminId);
    }

    public void insertAdmin(String email, String passwordHash) {
        jdbc.update("INSERT INTO registry_admins (email, password_hash, created_at) VALUES (?, ?, ?)",
                email, passwordHash, Instant.now().toString());
    }

    // ------------------------------------------------------------------ verification logs

    public void log(String institutionId, String event, String detail) {
        jdbc.update("INSERT INTO verification_logs (institution_id, event, detail, created_at) VALUES (?, ?, ?, ?)",
                institutionId, event, detail, Instant.now().toString());
    }

    public List<LogEntry> recentLogs(int limit) {
        return jdbc.query("SELECT * FROM verification_logs ORDER BY id DESC LIMIT ?",
                (rs, n) -> new LogEntry(rs.getLong("id"), rs.getString("institution_id"), rs.getString("event"),
                        rs.getString("detail"), Instant.parse(rs.getString("created_at"))),
                limit);
    }

    private <T> Optional<T> queryOne(String sql, RowMapper<T> mapper, Object... args) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(sql, mapper, args));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
