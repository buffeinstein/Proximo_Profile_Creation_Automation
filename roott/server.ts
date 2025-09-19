// import "dotenv/config";
// import express from "express";
// import Database from "better-sqlite3";
// import path from "node:path";
// import fs from "node:fs";
// import { randomUUID } from "node:crypto";

// const app = express();
// app.use(express.json());

// // Ensure db/ exists and open SQLite
// const dbDir = path.join(process.cwd(), "db");
// if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
// const dbPath = path.join(dbDir, "dev.db");
// const db = new Database(dbPath);
// db.pragma("foreign_keys = ON");

// // Load schema from file (single source of truth)
// const schemaPath = path.join(dbDir, "schema.sql");
// if (fs.existsSync(schemaPath)) {
//   const schemaSql = fs.readFileSync(schemaPath, "utf8");
//   db.exec(schemaSql);
// } else {
//   console.warn("db/schema.sql not found; skipping schema init. Ensure tables exist before running.");
// }

// // POST /api/import — insert one resume + its roles from a JSON array
// app.post("/api/import", (req, res) => {
//   const items = req.body;
//   if (!Array.isArray(items)) {
//     return res.status(400).json({ error: "Expected an array of role objects" });
//   }

//   const resumeId = randomUUID();
//   const insertResume = db.prepare("INSERT INTO resumes (id) VALUES (?)");
//   const insertRole = db.prepare(`
//     INSERT INTO roles (
//       id, resume_id, ordinal,
//       company_name, role_title, role_duration, role_description
//     ) VALUES (?, ?, ?, ?, ?, ?, ?)
//   `);

//   const tx = db.transaction((arr: any[]) => {
//     insertResume.run(resumeId);
//     arr.forEach((r, i) => {
//       insertRole.run(
//         randomUUID(),
//         resumeId,
//         i,
//         r.company_name ?? "Unknown",
//         r.role_title ?? "Unknown",
//         Number.isFinite(r.role_duration) ? r.role_duration : 0,
//         r.role_description ?? ""
//       );
//     });
//   });

//   try {
//     tx(items);
//     res.json({ resume_id: resumeId, count: items.length });
//   } catch (e: any) {
//     console.error(e);
//     res.status(500).json({ error: "Failed to import roles" });
//   }
// });

// // GET /api/resumes/:id/roles — fetch roles for a resume, ordered
// app.get("/api/resumes/:id/roles", (req, res) => {
//   const rows = db
//     .prepare("SELECT * FROM roles WHERE resume_id = ? ORDER BY ordinal ASC")
//     .all(req.params.id);
//   res.json(rows);
// });

// // Simple health check
// app.get("/api/health", (_req, res) => res.json({ ok: true }));

// const port = Number(process.env.PORT) || 3000;
// app.listen(port, () => {
//   console.log(`Server listening on http://localhost:${port}`);
// });

/**
 * server.ts
 *
 * Walking skeleton server:
 *  - Boots Express
 *  - Initializes (or creates) SQLite DB directory and loads schema
 *  - Mounts the resumes ingest router (POST /api/resumes/ingest)
 *  - Leaves legacy /api/import + /api/resumes/:id/roles endpoints TEMPORARILY (optional)
 *  - Adds health check, 404 handler, basic error middleware
 *
 * Next steps (not implemented here):
 *  - Extract DB setup into infrastructure/db.ts
 *  - Add jobs.controller.ts
 *  - Add snapshots.controller.ts
 *  - Add worker process
 *  - Add real ingestResume.model.ts (currently the controller may fall back to stub IDs)
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

// -----------------------------
// Database bootstrap (temporary inline; will be refactored to infrastructure/db.ts)
// -----------------------------
const dbDir = path.join(process.cwd(), "db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, process.env.SQLITE_FILENAME || "dev.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// Load schema if present
const schemaPath = path.join(dbDir, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
} else {
  console.warn("[server] db/schema.sql not found; ensure schema is created before real operations.");
}

// Expose (TEMP) globally or attach to app locals for early prototypes
// Later: export a singleton from infrastructure/db.ts
declare global {
  // eslint-disable-next-line no-var
  var __APP_DB__: Database.Database | undefined;
}
global.__APP_DB__ = db;

// -----------------------------
// Express app + middleware
// -----------------------------
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// (Optional) basic request logging for dev
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

// -----------------------------
// Routers (new architecture)
// -----------------------------
import resumesRouter from "./src/controllers/resumes.controller"; // adjust path if your controller lives elsewhere
app.use(resumesRouter); // It already declares full paths like /api/resumes/ingest

// -----------------------------
// Legacy / transitional endpoints (OPTIONAL)
// Keep only if you still need quick JSON import during early testing.
// Will be removed once ingest + worker + snapshot flow is stable.
// -----------------------------

app.post("/api/import", (req: Request, res: Response) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Expected an array of role objects" });
  }

  // Minimal defensive check: ensure roles table exists
  try {
    db.prepare("SELECT 1 FROM roles LIMIT 1").get();
  } catch {
    return res.status(500).json({ error: "roles table not found; ensure schema is initialized." });
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
    console.error("[/api/import] error:", e);
    res.status(500).json({ error: "Failed to import roles" });
  }
});

app.get("/api/resumes/:id/roles", (req: Request, res: Response) => {
  try {
    const rows = db
      .prepare("SELECT * FROM roles WHERE resume_id = ? ORDER BY ordinal ASC")
      .all(req.params.id);
    res.json(rows);
  } catch (e: any) {
    console.error("[/api/resumes/:id/roles] error:", e);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// -----------------------------
// Health check
// -----------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime_s: process.uptime() });
});

// -----------------------------
// 404 handler (after all routes)
// -----------------------------
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// -----------------------------
// Central error handler
// (Any next(err) or thrown error inside async handlers would land here if wrapped)
// -----------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error middleware]", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// -----------------------------
// Start server
// -----------------------------
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`[server] Listening on http://localhost:${port}`);
  console.log(`[server] DB path: ${dbPath}`);
  console.log(`[server] Ingest endpoint ready: POST /api/resumes/ingest`);
});