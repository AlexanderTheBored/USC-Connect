-- USC Centralized Routing System — Database Schema
-- PostgreSQL 14+
--
-- Run this once against a fresh database:
--   psql "$DATABASE_URL" -f schema.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- USERS
-- Populated on first Google OAuth login. Role is assigned based on the
-- ADMIN_CONFIG env var (see backend/src/config/admins.js). The email domain
-- check (@usc.edu.ph) happens in the auth layer before any INSERT.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    full_name       VARCHAR(255),
    picture_url     TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'student'
                        CHECK (role IN ('student', 'admin')),
    -- NULL for students; one of the allowed categories for admins
    admin_category  VARCHAR(50)
                        CHECK (admin_category IS NULL OR admin_category IN
                            ('Academic', 'Facilities', 'Admin/Registrar', 'IT Services')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admins must have a category; students must not.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_category_consistency;
ALTER TABLE users ADD CONSTRAINT users_role_category_consistency
    CHECK (
        (role = 'admin' AND admin_category IS NOT NULL) OR
        (role = 'student' AND admin_category IS NULL)
    );

-- ---------------------------------------------------------------------------
-- TICKETS
-- upvote_count is maintained automatically by triggers on the upvotes table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        VARCHAR(50) NOT NULL
                        CHECK (category IN
                            ('Academic', 'Facilities', 'Admin/Registrar', 'IT Services')),
    upvote_count    INTEGER NOT NULL DEFAULT 0 CHECK (upvote_count >= 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Under Review', 'Resolved')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_category      ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at    ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_upvote_count  ON tickets(upvote_count DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_author_id     ON tickets(author_id);

-- ---------------------------------------------------------------------------
-- UPVOTES
-- Composite primary key guarantees at most one vote per (ticket, user).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upvotes (
    ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_upvotes_user_id ON upvotes(user_id);

-- ---------------------------------------------------------------------------
-- RESPONSES
-- is_official_admin_response is set by the backend, not the client. Only
-- admins whose admin_category matches the ticket's category can produce
-- official responses; enforcement happens in the API layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS responses (
    id                              SERIAL PRIMARY KEY,
    ticket_id                       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id                       INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    body                            TEXT NOT NULL,
    is_official_admin_response      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_ticket_id   ON responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_responses_official    ON responses(ticket_id, is_official_admin_response);

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- Keep tickets.upvote_count in sync with the upvotes table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE tickets
            SET upvote_count = upvote_count + 1,
                updated_at   = NOW()
            WHERE id = NEW.ticket_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE tickets
            SET upvote_count = GREATEST(upvote_count - 1, 0),
                updated_at   = NOW()
            WHERE id = OLD.ticket_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upvotes_sync_count ON upvotes;
CREATE TRIGGER trg_upvotes_sync_count
AFTER INSERT OR DELETE ON upvotes
FOR EACH ROW EXECUTE FUNCTION sync_upvote_count();

-- Keep updated_at fresh on ticket mutations.
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
