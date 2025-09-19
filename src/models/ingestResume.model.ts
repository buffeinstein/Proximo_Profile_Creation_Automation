import { randomUUID } from "node:crypto";
import { getDb } from "../infrastructure/db";

interface UIRole {
  ordinal: number;
  company_name: string;
  company_size: string | null;
  company_industry: string | null;
  role_title: string;
  role_industry: string | null;
  role_seniority: string | null;
  role_duration: number | null;   // months
  role_description: string;
  role_star_1: string | null;
  role_star_2: string | null;
  role_star_3: string | null;
  metric_1: string | null;
  metric_2: string | null;
  metric_3: string | null;
}

interface ParsedResume {
  candidateName: string;
  roles: UIRole[];
}

interface IngestArgs {
  candidateName?: string;
  jobLink?: string;
  parsedResume: ParsedResume;
  resumeFile?: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  } | null;
}

/**
 * Fat model: Ingest a parsed resume
 *   1. Insert resume
 *   2. Insert job (status 'pending')
 *   3. Insert roles (ordinal order preserved)
 *   All inside a manual transaction.
 */
export function ingestResume(args: IngestArgs): { resumeId: string; jobId: string } {
  const { candidateName, jobLink, parsedResume } = args;

  if (!parsedResume || !Array.isArray(parsedResume.roles) || parsedResume.roles.length === 0) {
    throw new Error("parsedResume.roles must contain at least one role");
  }

  const finalCandidateName = candidateName || parsedResume.candidateName || null;
  parsedResume.roles.forEach(r => {
    if (typeof r.ordinal !== "number") {
      throw new Error("Each role requires a numeric ordinal");
    }
  });

  const db = getDb();
  const resumeId = `resume_${Date.now()}_${randomUUID()}`;
  const jobId = `job_${Date.now()}_${randomUUID()}`;

  // Prepare statements
  const insertResume = db.prepare(`
    INSERT INTO resumes (id, candidate_name, created_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const insertJob = db.prepare(`
    INSERT INTO jobs (
      id, resume_id, job_link, status,
      total_roles, completed_roles,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  const insertRole = db.prepare(`
    INSERT INTO roles (
      id, resume_id, ordinal,
      company_name, company_size, company_industry,
      role_title, role_industry, role_seniority,
      role_duration, role_description,
      role_star_1, role_star_2, role_star_3,
      metric_1, metric_2, metric_3,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);

  try {
    db.prepare("BEGIN").run();

    // 1. resume
    insertResume.run(resumeId, finalCandidateName);

    // 2. job (pending)
    insertJob.run(jobId, resumeId, jobLink || null, "pending", parsedResume.roles.length, 0);

    // 3. roles
    for (const role of parsedResume.roles) {
      const roleId = `role_${Date.now()}_${randomUUID()}`;
      insertRole.run(
        roleId,
        resumeId,
        role.ordinal,
        role.company_name,
        role.company_size,
        role.company_industry,
        role.role_title,
        role.role_industry,
        role.role_seniority,
        role.role_duration,
        role.role_description,
        role.role_star_1,
        role.role_star_2,
        role.role_star_3,
        role.metric_1,
        role.metric_2,
        role.metric_3
      );
    }

    db.prepare("COMMIT").run();
    return { resumeId, jobId };
  } catch (err) {
    try {
      db.prepare("ROLLBACK").run();
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  }
}