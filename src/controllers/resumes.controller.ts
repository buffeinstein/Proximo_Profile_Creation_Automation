// // /**
// //  * resumes.controller.ts
// //  *
// //  * Purpose:
// //  *   HTTP transport layer for ingesting a resume. Contract-first “walking skeleton” version.
// //  *   - Accepts multipart/form-data (PDF file + simple text fields).
// //  *   - Performs ONLY lightweight request validation (file presence/type, URL shape).
// //  *   - Delegates domain work to ingestResume.model (soon). For now, can fall back to a fake stub
// //  *     so the frontend can start polling immediately (returns synthetic resumeId + jobId).
// //  *   - Returns { resumeId, jobId } as the UI contract.
// //  *
// //  * Layer boundaries:
// //  *   - NO SQL here.
// //  *   - NO enrichment here.
// //  *   - NO long parsing here (demo uses deterministic pre-parsed resume).
// //  *
// //  * Follow-up work (other files, not in this file):
// //  *   - models/ingestResume.model.ts: real creation of resume, roles, job rows.
// //  *   - repositories & db wiring.
// //  */

// // import { Router, Request, Response } from "express";
// // import multer from "multer";
// // import { randomUUID } from "crypto";

// // const router = Router();


// // // TODO: confirm these restrictions actually work 

// // /**
// //  * Multer setup:
// //  *  - Memory storage is fine for the demo (we ignore the real PDF contents for now).
// //  *  - Apply a modest file size limit (e.g. 5 MB) to avoid accidental huge uploads.
// //  */
// // const upload = multer({
// //   storage: multer.memoryStorage(),
// //   limits: { fileSize: 5 * 1024 * 1024 } // 5MB
// // });

// // /**
// //  * Lightweight URL validation (syntactic only).
// //  */
// // function isLikelyHttpUrl(value: string | undefined | null): boolean {
// //   if (!value) return false;
// //   try {
// //     const u = new URL(value);
// //     return u.protocol === "http:" || u.protocol === "https:";
// //   } catch {
// //     return false;
// //   }
// // }



// // /**
// //  * Attempt to dynamically import the model. This lets the walking skeleton
// //  * run BEFORE the model is implemented (development convenience).
// //  *
// //  * NOTE: Once the real model exists, remove the fallback branch (or keep it as a safety net).
// //  */
// // async function callIngestResumeModel(payload: {
// //   candidateName?: string;
// //   jobLink?: string;
// //   // Buffer and original filename if we ever want to parse for real
// //   resumeFile?: { buffer: Buffer; originalName: string; mimeType: string } | null;
// // }): Promise<{ resumeId: string; jobId: string }> {
// //   try {
// //     // Dynamically import so this controller works even if the file is not present yet.
// //     const mod = await import("../models/ingestResume.model").catch(() => null);

// //     if (mod && typeof mod.ingestResume === "function") {
// //       // The real model is expected to:
// //       //   - Accept a normalized payload (candidateName, jobLink, parsedResume or file).
// //       //   - Return { resumeId, jobId, ... }.
// //       const result = await mod.ingestResume({
// //         candidateName: payload.candidateName,
// //         jobLink: payload.jobLink,
// //         // For the deterministic demo we hand the file along; the model may ignore it.
// //         resumeFile: payload.resumeFile
// //       });

// //       // We only expose the two IDs required by the frontend contract here.
// //       if (!result?.resumeId || !result?.jobId) {
// //         throw new Error("Model did not return resumeId/jobId");
// //       }
// //       return { resumeId: result.resumeId, jobId: result.jobId };
// //     }
// //   } catch (err) {
// //     // If the model exists but throws, we propagate (we only swallow the “module not found” case).
// //     throw err;
// //   }

// //   // Fallback stub: generate deterministic-looking IDs (UUIDs) so the UI can proceed.
// //   // Frontend polling will hit other endpoints that may still be unimplemented (501/404) during skeleton phase.
// //   return {
// //     resumeId: `stub-resume-${randomUUID()}`,
// //     jobId: `stub-job-${randomUUID()}`
// //   };
// // }

// // /**
// //  * POST /api/resumes/ingest
// //  *
// //  * Form fields (multipart):
// //  *  - resume_pdf (file)                OPTIONAL for the walking skeleton, but validated if provided
// //  *  - candidate_name (text)            OPTIONAL (can still ingest)
// //  *  - job_link (text, URL)             OPTIONAL (validated if present)
// //  *
// //  * Response (200):
// //  *  { resumeId: string, jobId: string }
// //  *
// //  * Error responses:
// //  *  - 400 Bad Request for validation failures (missing/invalid file type when required, malformed URL, etc.)
// //  *  - 413 Payload Too Large (handled automatically by multer if file exceeds limit)
// //  *  - 500 Internal Server Error for unexpected issues
// //  */
// // router.post(
// //   "/api/resumes/ingest",
// //   upload.single("resume_pdf"),
// //   async (req: Request, res: Response) => {
// //     try {
// //       const candidateName = (req.body.candidate_name || "").trim() || undefined;
// //       const jobLinkRaw = (req.body.job_link || "").trim();
// //       const jobLink = jobLinkRaw ? jobLinkRaw : undefined;

// //       // File (optional for now)
// //       const file = req.file
// //         ? {
// //             buffer: req.file.buffer,
// //             originalName: req.file.originalname,
// //             mimeType: req.file.mimetype
// //           }
// //         : null;

// //       // Basic validations (add or relax per needs)
// //       if (file) {
// //         // We allow a few common PDF mimetypes. Some browsers may send application/octet-stream; decide policy later.
// //         const allowed = ["application/pdf"];
// //         if (!allowed.includes(file.mimeType)) {
// //           return res.status(400).json({ message: "resume_pdf must be a PDF (application/pdf)" });
// //         }
// //       }

// //       if (jobLink && !isLikelyHttpUrl(jobLink)) {
// //         return res.status(400).json({ message: "job_link must be a valid http(s) URL" });
// //       }

// //       // Note: We intentionally do NOT enforce candidateName presence for flexibility.

// //       // Future: actual PDF parsing would happen in a dedicated service; here we just pass metadata along.

// //       const { resumeId, jobId } = await callIngestResumeModel({
// //         candidateName,
// //         jobLink,
// //         resumeFile: file
// //       });

// //       // Contract-first minimal response
// //       return res.status(200).json({ resumeId, jobId });
// //     } catch (err: any) {
// //       // Provide a minimal, non-leaky error message to the client.
// //       const msg = err?.message || "Internal server error";
// //       console.error("[resumes.controller] ingest error:", err);
// //       return res.status(500).json({ message: msg });
// //     }
// //   }
// // );

// // export default router;

// ////////////


// /**
//  * resumes.controller.ts
//  *
//  * Purpose:
//  *   HTTP transport layer for ingesting a resume (command endpoint).
//  *   - Accepts multipart/form-data (PDF + simple text fields) OR can work with no file yet.
//  *   - Performs ONLY lightweight request validation (file type, URL shape).
//  *   - Delegates domain creation to ingestResume.model (when present).
//  *   - For now uses a deterministic pre-parsed resume structure aligned 1:1 with UI fields.
//  *   - Returns { resumeId, jobId } so the frontend can begin polling.
//  *
//  * Layer boundaries:
//  *   - NO SQL here.
//  *   - NO enrichment here.
//  *   - NO long parsing here (we stub parsed resume).
//  *
//  * Fallback:
//  *   - If ../models/ingestResume.model is not implemented yet, returns stub IDs.
//  *
//  * Next work (outside this file):
//  *   - models/ingestResume.model.ts (create resume, roles, job rows in a transaction).
//  *   - jobs.controller.ts (GET job status for polling).
//  *   - snapshots.controller.ts + buildProfileSnapshot.model.ts (read projection).
//  */

// import { Router, Request, Response } from "express";
// import multer from "multer";
// import { randomUUID } from "crypto";

// const router = Router();

// /* -------------------------------------------------------------------------- */
// /* Multer configuration                                                       */
// /* -------------------------------------------------------------------------- */

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
// });

// /* -------------------------------------------------------------------------- */
// /* Lightweight helpers                                                        */
// /* -------------------------------------------------------------------------- */

// function isLikelyHttpUrl(value: string | undefined | null): boolean {
//   if (!value) return false;
//   try {
//     const u = new URL(value);
//     return u.protocol === "http:" || u.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// /* -------------------------------------------------------------------------- */
// /* Domain-facing types for the deterministic pre-parsed resume                */
// /* -------------------------------------------------------------------------- */

// /**
//  * UI-aligned role shape. All enrichment targets start as null so the worker
//  * can easily detect "needs generation" vs "intentionally empty."
//  *
//  * role_duration unit decision:
//  *   We treat role_duration as MONTHS in position.
//  *   Document this once, keep consistent everywhere (DB schema, worker logic, snapshot builder).
//  */
// interface UIRole {
//   ordinal: number;                 // Ordering (1-based). Not displayed directly in UI.
//   company_name: string;
//   company_size: string | null;
//   company_industry: string | null;
//   role_title: string;
//   role_industry: string | null;
//   role_seniority: string | null;
//   role_duration: number | null;    // Months in role (null if unknown).
//   role_description: string;
//   role_star_1: string | null;
//   role_star_2: string | null;
//   role_star_3: string | null;
//   metric_1: string | null;
//   metric_2: string | null;
//   metric_3: string | null;
// }

// interface PreParsedResume {
//   candidateName: string;
//   summary?: string;
//   roles: UIRole[];
// }

// /**
//  * Deterministic pre-parsed resume used until real parsing is implemented.
//  * Adjust / expand roles as needed for demo richness.
//  */
// function buildDemoPreParsedResume(explicitCandidateName?: string): PreParsedResume {
//   const name = explicitCandidateName || "Jane Doe";
//   return {
//     candidateName: name,
//     summary: "Engineer focused on operational efficiency and maker-space tooling.",
//     roles: [
//       {
//         ordinal: 1,
//         company_name: "Harvey Mudd Makerspace",
//         company_size: null,
//         company_industry: null,
//         role_title: "Software Engineer",
//         role_industry: null,
//         role_seniority: null,
//         role_duration: 40, // 40 months (example). Keep consistent across codebase.
//         role_description:
//           "Reduced item wait time by 75% by redesigning inventory software + database for 1.3K items / 1.5K yearly users, including live quantity/location tracking and automated restock system (JavaScript, Python, MongoDB). Managed ~60 inventory staff; founded and led Digital Loom dept—trained ~100 students on computational weaving.",
//         role_star_1: null,
//         role_star_2: null,
//         role_star_3: null,
//         metric_1: null,
//         metric_2: null,
//         metric_3: null
//       }
//       // Additional roles can be added here for richer snapshots.
//     ]
//   };
// }

// /* -------------------------------------------------------------------------- */
// /* Dynamic model invocation with graceful fallback                            */
// /* -------------------------------------------------------------------------- */

// async function callIngestResumeModel(payload: {
//   candidateName?: string;
//   jobLink?: string;
//   parsedResume: PreParsedResume;
//   resumeFile?: { buffer: Buffer; originalName: string; mimeType: string } | null;
// }): Promise<{ resumeId: string; jobId: string }> {
//   try {
//     // Dynamic import lets this controller operate before the model exists.
//     const mod = await import("../models/ingestResume.model").catch(() => null);

//     if (mod && typeof (mod as any).ingestResume === "function") {
//       const result = await (mod as any).ingestResume({
//         candidateName: payload.candidateName,
//         jobLink: payload.jobLink,
//         parsedResume: payload.parsedResume,
//         resumeFile: payload.resumeFile // Likely ignored once parsedResume is authoritative.
//       });

//       if (!result?.resumeId || !result?.jobId) {
//         throw new Error("Model did not return resumeId/jobId");
//       }
//       return { resumeId: result.resumeId, jobId: result.jobId };
//     }
//   } catch (err) {
//     // Model existed but failed -> propagate to 500 handler.
//     throw err;
//   }

//   // Fallback stub (model not present). Allows frontend flow to continue.
//   return {
//     resumeId: `stub-resume-${randomUUID()}`,
//     jobId: `stub-job-${randomUUID()}`
//   };
// }

// /* -------------------------------------------------------------------------- */
// /* Route: POST /api/resumes/ingest                                            */
// /* -------------------------------------------------------------------------- */

// router.post(
//   "/api/resumes/ingest",
//   upload.single("resume_pdf"),
//   async (req: Request, res: Response) => {
//     try {
//       const candidateNameRaw = (req.body.candidate_name || "").trim();
//       const candidateName = candidateNameRaw || undefined;

//       const jobLinkRaw = (req.body.job_link || "").trim();
//       const jobLink = jobLinkRaw || undefined;

//       // File (optional for now).
//       const file = req.file
//         ? {
//             buffer: req.file.buffer,
//             originalName: req.file.originalname,
//             mimeType: req.file.mimetype
//           }
//         : null;

//       // Lightweight validation:
//       if (file) {
//         const allowed = ["application/pdf"];
//         if (!allowed.includes(file.mimeType)) {
//           return res
//             .status(400)
//             .json({ message: "resume_pdf must be a PDF (application/pdf)" });
//         }
//       }

//       if (jobLink && !isLikelyHttpUrl(jobLink)) {
//         return res.status(400).json({ message: "job_link must be a valid http(s) URL" });
//       }

//       // Build deterministic pre-parsed resume (ignoring file contents).
//       const preParsed = buildDemoPreParsedResume(candidateName);

//       // NOTE: parsedResume is authoritative; resumeFile is passed only for future real parsing.
//       const { resumeId, jobId } = await callIngestResumeModel({
//         candidateName,
//         jobLink,
//         parsedResume: preParsed,
//         resumeFile: file
//       });

//       return res.status(200).json({ resumeId, jobId });
//     } catch (err: any) {
//       const msg = err?.message || "Internal server error";
//       console.error("[resumes.controller] ingest error:", err);
//       return res.status(500).json({ message: msg });
//     }
//   }
// );

// export default router;


/**
 * resumes.controller.ts
 *
 * Purpose:
 *   HTTP transport layer for ingesting a resume (command endpoint).
 *   - Accepts multipart/form-data (PDF + simple text fields) OR can work with no file.
 *   - Performs ONLY lightweight request validation (file type, URL shape).
 *   - Delegates creation to ingestResume.model (fat model does SQL).
 *   - Uses a deterministic pre-parsed resume (roles only) aligned 1:1 with UI fields.
 *   - Returns { resumeId, jobId } so the frontend can begin polling.
 *
 * Layer boundaries:
 *   - NO SQL here.
 *   - NO enrichment here.
 *   - NO parsing of real PDF yet (stub only).
 *
 * Fallback:
 *   - If ../models/ingestResume.model is absent, returns stub IDs so UI flow still works.
 */

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