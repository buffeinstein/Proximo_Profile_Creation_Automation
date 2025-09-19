import "dotenv/config";
import { getDb } from "./infrastructure/db";
import {
  claimNextPendingJob,
  getJob,
  getRolesForResume,
  updateEnrichedRole,
  updateJobProgress,
  markJobCompleted,
  markJobError,
  syncJobTotalIfNeeded
} from "./infrastructure/jobsRepo";
import { enrichRoleAI } from "./models/enrichRoleAI.model";


const LOOP_SLEEP_MS = 2_000;
const BETWEEN_ROLE_SLEEP_MS = 300; // small delay to avoid hammering model API
let shuttingDown = false;

async function main() {
  console.log("👷 Worker started (resume enrichment)…");

  while (!shuttingDown) {
    try {
      const job = claimNextPendingJob();

      if (!job) {
        await sleep(LOOP_SLEEP_MS);
        continue;
      }

      console.log(`▶️ Claimed job ${job.id} (resume=${job.resume_id})`);

      const roles = getRolesForResume(job.resume_id);
      if (!roles.length) {
        console.warn(`⚠️ Job ${job.id} has no roles; marking complete.`);
        markJobCompleted(job.id);
        continue;
      }

      // Ensure total_roles matches actual roles (in case ingestion mismatch)
      syncJobTotalIfNeeded(job.id, roles.length);

      for (const role of roles) {
        // Check if job got cancelled / changed mid-run
        const latest = getJob(job.id);
        if (!latest) {
          console.warn(`⚠️ Job ${job.id} disappeared mid-run; aborting.`);
          break;
        }
        if (latest.status !== "running") {
            console.warn(`⚠️ Job ${job.id} status changed to ${latest.status}; aborting enrichment loop.`);
            break;
        }

        const needsEnrichment =
          !role.enriched_at ||
          !role.role_star_1 ||
          !role.metric_1; // simple heuristic; refine later.

        if (!needsEnrichment) {
          console.log(`⏭️ [${job.id}] Role ${role.id} already enriched; skipping.`);
          updateJobProgress(job.id, 1);
          continue;
        }

        console.log(`🔧 [${job.id}] Enriching role #${role.ordinal} (${role.role_title} @ ${role.company_name})`);

        try {
          const enrichment = await enrichRoleAI({
            company_name: role.company_name,
            role_title: role.role_title,
            role_description: role.role_description,
            role_duration: role.role_duration,
            company_industry: role.company_industry,
            role_industry: role.role_industry,
            role_seniority: role.role_seniority
          });

            updateEnrichedRole(role.id, {
              role_description: enrichment.role_description,
              role_star_1: enrichment.star_stories[0] || null,
              role_star_2: enrichment.star_stories[1] || null,
              role_star_3: enrichment.star_stories[2] || null,
              metric_1: enrichment.metrics[0] || null,
              metric_2: enrichment.metrics[1] || null,
              metric_3: enrichment.metrics[2] || null
            });

          updateJobProgress(job.id, 1);
          console.log(`✅ [${job.id}] Enriched role ${role.id}`);
        } catch (roleErr) {
          console.error(`❌ [${job.id}] Failed enriching role ${role.id}:`, (roleErr as any)?.message || roleErr);
          // We still increment progress so UI doesn't stall, but do NOT fill fields.
          updateJobProgress(job.id, 1);
        }

        if (shuttingDown) break;
        await sleep(BETWEEN_ROLE_SLEEP_MS);
      }

      // Re-fetch to get final counters
      const finalJob = getJob(job.id);
      if (finalJob && finalJob.completed_roles >= finalJob.total_roles && finalJob.status === "running") {
        markJobCompleted(job.id);
        console.log(`🎉 Job ${job.id} completed (roles: ${finalJob.completed_roles}/${finalJob.total_roles})`);
      } else if (finalJob?.status === "running") {
        // Partial completion (maybe aborted)
        console.warn(`⚠️ Job ${job.id} ended loop but not complete (status still 'running')`);
      }

    } catch (err) {
      console.error("🔥 Worker loop error:", (err as any)?.message || err);
      // Attempt to store generic error if we can guess job context—skipped here
    }
  }

  console.log("👋 Worker shutting down gracefully.");
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

/* ------------------------------- Signals ---------------------------------- */
process.on("SIGINT", () => {
  console.log("🔻 SIGINT received");
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  console.log("🔻 SIGTERM received");
  shuttingDown = true;
});

/* Ensure DB is initialized before starting */
getDb();
main().catch(err => {
  console.error("🚨 Worker failed to start:", err);
  process.exit(1);
});