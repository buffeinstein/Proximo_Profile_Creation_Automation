import { Router, Request, Response } from "express";
import { getDb } from "../infrastructure/db";

const router = Router();

/**
 * GET /api/jobs/:jobId
 * Return status/progress of a job.
 */
router.get("/api/jobs/:jobId", (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const db = getDb();

    const row = db.prepare(`
      SELECT id, resume_id, status, total_roles, completed_roles, last_error
      FROM jobs
      WHERE id = ?
    `).get(jobId);

    if (!row) return res.status(404).json({ message: "Job not found" });

    res.json({
      jobId: row.id,
      resumeId: row.resume_id,
      status: row.status,
      total_roles: row.total_roles,
      completed_roles: row.completed_roles,
      last_error: row.last_error
    });
  } catch (err) {
    console.error("[jobs.controller] error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;