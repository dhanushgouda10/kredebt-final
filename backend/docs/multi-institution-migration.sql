-- Kredent: multi-institution support (PostgreSQL).
--
-- In development (spring.jpa.hibernate.ddl-auto=update) Hibernate creates all of this
-- automatically. The `prod` profile uses ddl-auto=validate, which refuses to start until the schema
-- matches the entities — run this script once against the production database BEFORE deploying.

CREATE TABLE IF NOT EXISTS institutions (
    id                      BIGSERIAL PRIMARY KEY,
    registry_institution_id VARCHAR(40)  NOT NULL,
    name                    VARCHAR(200) NOT NULL,
    state                   VARCHAR(80)  NOT NULL,
    district                VARCHAR(80)  NOT NULL,
    verified                BOOLEAN      NOT NULL DEFAULT FALSE,
    verified_at             TIMESTAMP,
    wallet_address          VARCHAR(42),          -- intentionally NOT unique: demo colleges share one wallet
    wallet_linked_at        TIMESTAMP,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_institutions_registry_id UNIQUE (registry_institution_id)
);

CREATE TABLE IF NOT EXISTS institution_verification_sessions (
    id                      UUID PRIMARY KEY,
    registry_institution_id VARCHAR(40)  NOT NULL,
    otp_hash                VARCHAR(128) NOT NULL,
    otp_salt                VARCHAR(64)  NOT NULL,
    expires_at              TIMESTAMP    NOT NULL,
    attempts                INTEGER      NOT NULL DEFAULT 0,
    status                  VARCHAR(20)  NOT NULL,
    created_at              TIMESTAMP    NOT NULL,
    verified_at             TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ivs_registry_id_created
    ON institution_verification_sessions (registry_institution_id, created_at);

-- Certificates remember which institution issued them (nullable: pre-existing rows have none).
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions (id);

-- Students belong to an institution, and a USN is unique per institution (not platform-wide).
ALTER TABLE students ADD COLUMN IF NOT EXISTS institution_id BIGINT REFERENCES institutions (id);
-- The old platform-wide unique constraint on usn has a generated name; find it with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'students'::regclass AND contype = 'u';
-- then drop the one that covers only (usn), e.g.:
--   ALTER TABLE students DROP CONSTRAINT <that_name>;
ALTER TABLE students ADD CONSTRAINT uk_students_institution_usn UNIQUE (institution_id, usn);

-- Every audit row belongs to an institution so each institution only reads its own trail.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS institution_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution ON audit_logs (institution_id);

-- Rows created before multi-institution support have no institution. Either run the UPDATEs below
-- for the institution that owned that data (id from `SELECT id, registry_institution_id FROM institutions`),
-- or set INSTITUTION_ADOPT_LEGACY_DATA_FOR=<its registry institutional ID> once and restart.
--   UPDATE students      SET institution_id = <id> WHERE institution_id IS NULL;
--   UPDATE certificates  SET institution_id = <id> WHERE institution_id IS NULL;
--   UPDATE audit_logs    SET institution_id = <id> WHERE institution_id IS NULL;
