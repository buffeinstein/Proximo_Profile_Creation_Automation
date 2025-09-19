import { Router, Request, Response } from "express";
import multer from "multer";
import { randomUUID } from "crypto";

const router = Router();

/* -------------------------------------------------------------------------- */
/* Multer configuration                                                       */
/* -------------------------------------------------------------------------- */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* -------------------------------------------------------------------------- */
/* Lightweight helpers                                                        */
/* -------------------------------------------------------------------------- */

function isLikelyHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Domain-facing types (roles only — no summary)                              */
/* -------------------------------------------------------------------------- */

/**
 * UI-aligned role shape. All enrichment targets start as null so the worker
 * can easily detect "needs generation" vs "intentionally empty."
 *
 * role_duration unit:
 *   Interpreted as MONTHS in role (null if unknown). Keep consistent everywhere.
 */
interface UIRole {
  ordinal: number;                 // 1-based ordering for stable display.
  company_name: string;
  company_size: string | null;
  company_industry: string | null;
  role_title: string;
  role_industry: string | null;
  role_seniority: string | null;
  role_duration: number | null;    // Months (null if unknown).
  role_description: string;
  role_star_1: string | null;
  role_star_2: string | null;
  role_star_3: string | null;
  metric_1: string | null;
  metric_2: string | null;
  metric_3: string | null;
}

interface PreParsedResume {
  candidateName: string;
  roles: UIRole[];
}

/**
 * Deterministic pre-parsed resume used until real parsing is implemented.
 * NO summary field (per current requirements).
 */
function buildDemoPreParsedResume(explicitCandidateName?: string): PreParsedResume {
  const name = explicitCandidateName || "Jane Doe";
  return {
    candidateName: name,
    roles: [
      {
        ordinal: 1,
        company_name: "Harvey Mudd Makerspace",
        company_size: null,
        company_industry: null,
        role_title: "Software Engineer",
        role_industry: null,
        role_seniority: null,
        role_duration: 40, // 40 months (example).
        role_description:
          "Reduced item wait time by 75% by redesigning inventory software + database for 1.3K items / 1.5K yearly users, including live quantity/location tracking and automated restock system (JavaScript, Python, MongoDB). Managed ~60 inventory staff; founded and led Digital Loom dept—trained ~100 students on computational weaving.",
        role_star_1: null,
        role_star_2: null,
        role_star_3: null,
        metric_1: null,
        metric_2: null,
        metric_3: null
      }
      // Add more roles for demo richness if needed.
    ]
  };
}

/* -------------------------------------------------------------------------- */
/* Dynamic model invocation with graceful fallback                            */
/* -------------------------------------------------------------------------- */

async function callIngestResumeModel(payload: {
  candidateName?: string;
  jobLink?: string;
  parsedResume: PreParsedResume;
  resumeFile?: { buffer: Buffer; originalName: string; mimeType: string } | null;
}): Promise<{ resumeId: string; jobId: string }> {
  try {
    const mod = await import("../models/ingestResume.model").catch(() => null);

    if (mod && typeof (mod as any).ingestResume === "function") {
      const result = await (mod as any).ingestResume({
        candidateName: payload.candidateName,
        jobLink: payload.jobLink,
        parsedResume: payload.parsedResume,
        resumeFile: payload.resumeFile
      });

      if (!result?.resumeId || !result?.jobId) {
        throw new Error("Model did not return resumeId/jobId");
      }
      return { resumeId: result.resumeId, jobId: result.jobId };
    }
  } catch (err) {
    // If the model is present but throws, propagate (controller 500 handler will catch).
    throw err;
  }

  // Fallback stub when model file does not yet exist.
  return {
    resumeId: `stub-resume-${randomUUID()}`,
    jobId: `stub-job-${randomUUID()}`
  };
}

/* -------------------------------------------------------------------------- */
/* Route: POST /api/resumes/ingest                                            */
/* -------------------------------------------------------------------------- */

router.post(
  "/api/resumes/ingest",
  upload.single("resume_pdf"),
  async (req: Request, res: Response) => {
    try {
      const candidateNameRaw = (req.body.candidate_name || "").trim();
      const candidateName = candidateNameRaw || undefined;

      const jobLinkRaw = (req.body.job_link || "").trim();
      const jobLink = jobLinkRaw || undefined;

      const file = req.file
        ? {
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
          }
        : null;

      // Lightweight validation
      if (file) {
        if (file.mimeType !== "application/pdf") {
          return res
            .status(400)
            .json({ message: "resume_pdf must be a PDF (application/pdf)" });
        }
      }

      if (jobLink && !isLikelyHttpUrl(jobLink)) {
        return res.status(400).json({ message: "job_link must be a valid http(s) URL" });
      }

      // Build deterministic parsed resume (roles only).
      const preParsed = buildDemoPreParsedResume(candidateName);

      const { resumeId, jobId } = await callIngestResumeModel({
        candidateName,
        jobLink,
        parsedResume: preParsed,
        resumeFile: file
      });

      return res.status(200).json({ resumeId, jobId });
    } catch (err: any) {
      const msg = err?.message || "Internal server error";
      console.error("[resumes.controller] ingest error:", err);
      return res.status(500).json({ message: msg });
    }
  }
);

export default router;