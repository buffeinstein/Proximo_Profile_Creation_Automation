import "dotenv/config";
import express from "express";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const app = express();
app.use(express.json());

// Ensure db/ exists and open SQLite
const dbDir = path.join(process.cwd(), "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "dev.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// Load schema from file (single source of truth)
const schemaPath = path.join(dbDir, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
} else {
  console.warn("db/schema.sql not found; skipping schema init. Ensure tables exist before running.");
}

// POST /api/import — insert one resume + its roles from a JSON array
app.post("/api/import", (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Expected an array of role objects" });
  }

  const resumeId = randomUUID();
  const insertResume = db.prepare("INSERT INTO resumes (id) VALUES (?)");
  const insertRole = db.prepare(`
    INSERT INTO roles (
      id, resume_id, ordinal,
      company_name, role_title, role_duration, role_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((arr: any[]) => {
    insertResume.run(resumeId);
    arr.forEach((r, i) => {
      insertRole.run(
        randomUUID(),
        resumeId,
        i,
        r.company_name ?? "Unknown",
        r.role_title ?? "Unknown",
        Number.isFinite(r.role_duration) ? r.role_duration : 0,
        r.role_description ?? ""
      );
    });
  });

  try {
    tx(items);
    res.json({ resume_id: resumeId, count: items.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Failed to import roles" });
  }
});

// GET /api/resumes/:id/roles — fetch roles for a resume, ordered
app.get("/api/resumes/:id/roles", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM roles WHERE resume_id = ? ORDER BY ordinal ASC")
    .all(req.params.id);
  res.json(rows);
});

// Simple health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});