/**
 * resumes.controller.ts
 *
 * Purpose:
 *   HTTP transport layer for ingesting a resume. Contract-first “walking skeleton” version.
 *   - Accepts multipart/form-data (PDF file + simple text fields).
 *   - Performs ONLY lightweight request validation (file presence/type, URL shape).
 *   - Delegates domain work to ingestResume.model (soon). For now, can fall back to a fake stub
 *     so the frontend can start polling immediately (returns synthetic resumeId + jobId).
 *   - Returns { resumeId, jobId } as the UI contract.
 *
 * Layer boundaries:
 *   - NO SQL here.
 *   - NO enrichment here.
 *   - NO long parsing here (demo uses deterministic pre-parsed resume).
 *
 * Follow-up work (other files, not in this file):
 *   - models/ingestResume.model.ts: real creation of resume, roles, job rows.
 *   - repositories & db wiring.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";

const router = Router();

/**
 * Multer setup:
 *  - Memory storage is fine for the demo (we ignore the real PDF contents for now).
 *  - Apply a modest file size limit (e.g. 5 MB) to avoid accidental huge uploads.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * Lightweight URL validation (syntactic only).
 */
function isLikelyHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Attempt to dynamically import the model. This lets the walking skeleton
 * run BEFORE the model is implemented (development convenience).
 *
 * NOTE: Once the real model exists, remove the fallback branch (or keep it as a safety net).
 */
async function callIngestResumeModel(payload: {
  candidateName?: string;
  jobLink?: string;
  // Buffer and original filename if we ever want to parse for real
  resumeFile?: { buffer: Buffer; originalName: string; mimeType: string } | null;
}): Promise<{ resumeId: string; jobId: string }> {
  try {
    // Dynamically import so this controller works even if the file is not present yet.
    // Adjust the relative path to match your actual project structure.
    const mod = await import("../models/ingestResume.model").catch(() => null);

    if (mod && typeof mod.ingestResume === "function") {
      // The real model is expected to:
      //   - Accept a normalized payload (candidateName, jobLink, parsedResume or file).
      //   - Return { resumeId, jobId, ... }.
      const result = await mod.ingestResume({
        candidateName: payload.candidateName,
        jobLink: payload.jobLink,
        // For the deterministic demo we hand the file along; the model may ignore it.
        resumeFile: payload.resumeFile
      });

      // We only expose the two IDs required by the frontend contract here.
      if (!result?.resumeId || !result?.jobId) {
        throw new Error("Model did not return resumeId/jobId");
      }
      return { resumeId: result.resumeId, jobId: result.jobId };
    }
  } catch (err) {
    // If the model exists but throws, we propagate (we only swallow the “module not found” case).
    throw err;
  }

  // Fallback stub: generate deterministic-looking IDs (UUIDs) so the UI can proceed.
  // Frontend polling will hit other endpoints that may still be unimplemented (501/404) during skeleton phase.
  return {
    resumeId: `stub-resume-${randomUUID()}`,
    jobId: `stub-job-${randomUUID()}`
  };
}

/**
 * POST /api/resumes/ingest
 *
 * Form fields (multipart):
 *  - resume_pdf (file)                OPTIONAL for the walking skeleton, but validated if provided
 *  - candidate_name (text)            OPTIONAL (can still ingest)
 *  - job_link (text, URL)             OPTIONAL (validated if present)
 *
 * Response (200):
 *  { resumeId: string, jobId: string }
 *
 * Error responses:
 *  - 400 Bad Request for validation failures (missing/invalid file type when required, malformed URL, etc.)
 *  - 413 Payload Too Large (handled automatically by multer if file exceeds limit)
 *  - 500 Internal Server Error for unexpected issues
 */
router.post(
  "/api/resumes/ingest",
  upload.single("resume_pdf"),
  async (req: Request, res: Response) => {
    try {
      const candidateName = (req.body.candidate_name || "").trim() || undefined;
      const jobLinkRaw = (req.body.job_link || "").trim();
      const jobLink = jobLinkRaw ? jobLinkRaw : undefined;

      // File (optional for now)
      const file = req.file
        ? {
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
          }
        : null;

      // Basic validations (add or relax per needs)
      if (file) {
        // We allow a few common PDF mimetypes. Some browsers may send application/octet-stream; decide policy later.
        const allowed = ["application/pdf"];
        if (!allowed.includes(file.mimeType)) {
          return res.status(400).json({ message: "resume_pdf must be a PDF (application/pdf)" });
        }
      }

      if (jobLink && !isLikelyHttpUrl(jobLink)) {
        return res.status(400).json({ message: "job_link must be a valid http(s) URL" });
      }

      // Note: We intentionally do NOT enforce candidateName presence for flexibility.

      // Future: actual PDF parsing would happen in a dedicated service; here we just pass metadata along.

      const { resumeId, jobId } = await callIngestResumeModel({
        candidateName,
        jobLink,
        resumeFile: file
      });

      // Contract-first minimal response
      return res.status(200).json({ resumeId, jobId });
    } catch (err: any) {
      // Provide a minimal, non-leaky error message to the client.
      const msg = err?.message || "Internal server error";
      console.error("[resumes.controller] ingest error:", err);
      return res.status(500).json({ message: msg });
    }
  }
);

export default router;