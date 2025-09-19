-- Minimal schema for the demo (SQLite)

CREATE TABLE IF NOT EXISTS resumes (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id                         TEXT PRIMARY KEY,
  resume_id                  TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,

  -- Preserve the original order from the input JSON array
  ordinal                    INTEGER NOT NULL,

  -- Pre-scraped (immediate UI value)
  company_name               TEXT NOT NULL,
  role_title                 TEXT NOT NULL,
  role_duration              INTEGER NOT NULL,  -- months
  role_description           TEXT NOT NULL,

  -- Enriched (filled by LLM over time)
  enriched_company_size      TEXT,
  enriched_company_industry  TEXT,
  enriched_role_industry     TEXT,
  enriched_role_seniority    TEXT,
  role_star_1                TEXT,
  role_star_2                TEXT,
  role_star_3                TEXT,
  metric_1                   TEXT,
  metric_2                   TEXT,
  metric_3                   TEXT,

  created_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_resume_ordinal ON roles(resume_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_roles_resume ON roles(resume_id);