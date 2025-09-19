import { Router, Request, Response } from "express";
import { getDb } from "../infrastructure/db";

const router = Router();

/**
 * GET /api/resumes/:resumeId/snapshot
 * Returns candidateName + ordered roles for UI display.
 */
router.get("/api/resumes/:resumeId/snapshot", (req: Request, res: Response) => {
  try {
    const { resumeId } = req.params;
    const db = getDb();

    const resume = db.prepare(`
      SELECT candidate_name
      FROM resumes
      WHERE id = ?
    `).get(resumeId);

    if (!resume) return res.status(404).json({ message: "Resume not found" });

    const roles = db.prepare(`
      SELECT
        ordinal,
        company_name,
        company_size,
        company_industry,
        role_title,
        role_industry,
        role_seniority,
        role_duration,
        role_description,
        role_star_1,
        role_star_2,
        role_star_3,
        metric_1,
        metric_2,
        metric_3
      FROM roles
      WHERE resume_id = ?
      ORDER BY ordinal ASC
    `).all(resumeId);

    res.json({
      resumeId,
      candidateName: resume.candidate_name,
      roles
    });
  } catch (err) {
    console.error("[snapshots.controller] error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});




// router.get("/api/resumes/:resumeId/snapshot", (req: Request, res: Response) => {
//   try {
//     const { resumeId } = req.params;
//     console.log("[snapshots] GET request for:", resumeId); // ADD THIS
    
//     const db = getDb();

//     const resume = db.prepare(`
//       SELECT candidate_name
//       FROM resumes
//       WHERE id = ?
//     `).get(resumeId);

//     console.log("[snapshots] Resume found:", resume); // ADD THIS

//     if (!resume) return res.status(404).json({ message: "Resume not found" });

//     const roles = db.prepare(`
//       SELECT
//         ordinal,
//         company_name,
//         company_size,
//         company_industry,
//         role_title,
//         role_industry,
//         role_seniority,
//         role_duration,
//         role_description,
//         role_star_1,
//         role_star_2,
//         role_star_3,
//         metric_1,
//         metric_2,
//         metric_3
//       FROM roles
//       WHERE resume_id = ?
//       ORDER BY ordinal ASC
//     `).all(resumeId);

//     console.log("[snapshots] Roles found:", roles.length, roles); // ADD THIS

//     const response = {
//       resumeId,
//       candidateName: resume.candidate_name,
//       roles
//     };

//     console.log("[snapshots] Sending response:", JSON.stringify(response, null, 2)); // ADD THIS

//     res.json(response);
//   } catch (err) {
//     console.error("[snapshots.controller] error", err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

export default router;