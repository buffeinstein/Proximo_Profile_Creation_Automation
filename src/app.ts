import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

// Routers
import resumesRouter from "./controllers/resumes.controller";
import jobsRouter from "./controllers/jobs.controller";
import snapshotsRouter from "./controllers/snapshots.controller";

export const app = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dev request logging (optional)
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[req] ${req.method} ${req.url}`);
    next();
  });
}

// Mount API routers (each defines its own /api/... paths)
app.use(resumesRouter);
app.use(jobsRouter);
app.use(snapshotsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime_s: process.uptime() });
});

// 404 handler (must be after all other routes)
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Central error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error middleware]", err);
  res.status(500).json({ message: "Internal Server Error" });
});