import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

/**
 * Singleton access to a better-sqlite3 database.
 * Ensures schema on first load (idempotent CREATE TABLE IF NOT EXISTS).
 */
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const fileName = process.env.SQLITE_FILENAME || "dev.db";
  const dbPath = path.join(dbDir, fileName);

  db = new Database(dbPath);
  db.pragma("foreign_keys = ON");

  ensureSchema(db);
  return db;
}

function ensureSchema(db: Database.Database) {
  // resumes
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      candidate_name TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // jobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      job_link TEXT,
      status TEXT NOT NULL,
      total_roles INTEGER NOT NULL,
      completed_roles INTEGER NOT NULL,
      last_error TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // roles
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      company_name TEXT NOT NULL,
      company_size TEXT,
      company_industry TEXT,
      role_title TEXT NOT NULL,
      role_industry TEXT,
      role_seniority TEXT,
      role_duration INTEGER,
      role_description TEXT NOT NULL,
      role_star_1 TEXT,
      role_star_2 TEXT,
      role_star_3 TEXT,
      metric_1 TEXT,
      metric_2 TEXT,
      metric_3 TEXT,
      enriched_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_roles_resume_ordinal
      ON roles(resume_id, ordinal);
  `);
}