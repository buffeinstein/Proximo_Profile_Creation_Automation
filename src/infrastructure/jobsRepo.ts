import { getDb } from "./db";

export interface JobRow {
  id: string;
  resume_id: string;
  job_link: string | null;
  status: string;
  total_roles: number;
  completed_roles: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleRowForEnrichment {
  id: string;
  resume_id: string;
  ordinal: number;
  company_name: string;
  company_size: string | null;
  company_industry: string | null;
  role_title: string;
  role_industry: string | null;
  role_seniority: string | null;
  role_duration: number | null;
  role_description: string;
  role_star_1: string | null;
  role_star_2: string | null;
  role_star_3: string | null;
  metric_1: string | null;
  metric_2: string | null;
  metric_3: string | null;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

const db = getDb();

/* -------------------------------- Jobs ----------------------------------- */

// export function claimNextPendingJob(): JobRow | null {
//   // Find a pending job
//   const pending = db.prepare(`
//     SELECT *
//       FROM jobs
//      WHERE status = 'pending'
//      ORDER BY created_at ASC
//      LIMIT 1
//   `).get() as JobRow | undefined;

//   if (!pending) return null;

//   // Attempt atomic claim
//   const changed = db.prepare(`
//     UPDATE jobs
//        SET status = 'running',
//            updated_at = CURRENT_TIMESTAMP
//      WHERE id = ? AND status = 'pending'
//   `).run(pending.id).changes;

//   if (!changed) {
//     // Lost race
//     return null;
//   }

//   // Return fresh row
//   return getJob(pending.id);
// }

export function claimNextPendingJob(): JobRow | null {
  // Step 1: find a pending job
  const pending = db.prepare(`
    SELECT *
      FROM jobs
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 1
  `).get() as JobRow | undefined;

  if (!pending) {
    // No pending jobs right now
    console.log("[claim] No pending job found");
    return null;
  }

  console.log(
    "[claim] Candidate:",
    pending.id,
    "status(before) =", pending.status,
    "created_at =", pending.created_at,
    "updated_at =", pending.updated_at
  );

  // Step 2: attempt to atomically flip to running
  const updateStmt = db.prepare(`
    UPDATE jobs
       SET status = 'running',
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'
  `);

  const res = updateStmt.run(pending.id);
  console.log("[claim] UPDATE changes:", res.changes, "for job", pending.id);

  if (res.changes !== 1) {
    console.log("[claim] Lost race (row not pending anymore):", pending.id);
    return null;
  }

  // Step 3: fetch fresh row
  const fresh = getJob(pending.id);
  console.log("[claim] After update:", fresh?.id, "status =", fresh?.status, "updated_at =", fresh?.updated_at);

  return fresh;
}

export function getJob(jobId: string): JobRow | null {
  return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as JobRow | null;
}

export function updateJobProgress(jobId: string, deltaCompleted: number) {
  db.prepare(`
    UPDATE jobs
       SET completed_roles = completed_roles + ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `).run(deltaCompleted, jobId);
}

export function markJobCompleted(jobId: string) {
  db.prepare(`
    UPDATE jobs
       SET status = 'completed',
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `).run(jobId);
}

export function markJobError(jobId: string, message: string) {
  db.prepare(`
    UPDATE jobs
       SET status = 'error',
           last_error = ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `).run(message.slice(0, 500), jobId);
}

/* ------------------------------ Roles ------------------------------------ */

export function getRolesForResume(resumeId: string): RoleRowForEnrichment[] {
  return db.prepare(`
    SELECT *
      FROM roles
     WHERE resume_id = ?
     ORDER BY ordinal ASC
  `).all(resumeId) as RoleRowForEnrichment[];
}

export function updateEnrichedRole(roleId: string, data: {
  role_description: string;
  role_star_1: string | null;
  role_star_2: string | null;
  role_star_3: string | null;
  metric_1: string | null;
  metric_2: string | null;
  metric_3: string | null;
}) {
  db.prepare(`
    UPDATE roles
       SET role_description = ?,
           role_star_1 = ?,
           role_star_2 = ?,
           role_star_3 = ?,
           metric_1 = ?,
           metric_2 = ?,
           metric_3 = ?,
           enriched_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `).run(
    data.role_description,
    data.role_star_1,
    data.role_star_2,
    data.role_star_3,
    data.metric_1,
    data.metric_2,
    data.metric_3,
    roleId
  );
}

export function syncJobTotalIfNeeded(jobId: string, actualTotal: number) {
  db.prepare(`
    UPDATE jobs
       SET total_roles = ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND total_roles <> ?
  `).run(actualTotal, jobId, actualTotal);
}