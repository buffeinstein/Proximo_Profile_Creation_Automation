
import "dotenv/config";
import { app } from "./app";
import { getDb } from "./infrastructure/db";

// Initialize DB (ensures schema) before listening
getDb();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] POST /api/resumes/ingest`);
  console.log(`[server] GET  /api/jobs/:jobId`);
  console.log(`[server] GET  /api/resumes/:resumeId/snapshot`);
});