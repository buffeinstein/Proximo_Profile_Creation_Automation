import React, { useCallback, useEffect, useRef, useState } from "react";

type JobStatus = "pending" | "running" | "completed";
interface JobProgress {
  jobId: string;
  status: JobStatus;
  total_roles: number;
  completed_roles: number;
}

interface Role {
  role_id: string;
  ordinal: number;
  title?: string;
  company?: string;
  role_duration?: number;
  company_size?: string;
  company_industry?: string;
  role_industry?: string;
  role_seniority?: string;
  role_star_1?: string;
  role_star_2?: string;
  role_star_3?: string;
  metric_1?: string;
  metric_2?: string;
  metric_3?: string;
  role_description?: string;
}

interface Snapshot {
  resumeId: string;
  full_name?: string;
  roles: Role[];
}

const POLL_INTERVAL_MS = 1000;

// Always show at least THIS MANY placeholder role modules
const MIN_BASE_PLACEHOLDERS = 1;

const tagStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 12,
  background: "#eef2f5",
  color: "#333",
  marginRight: 6,
  marginBottom: 4,
  border: "1px solid #d5dde3"
};

const boxLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#555",
  marginBottom: 4
};

const textBoxStyle: React.CSSProperties = {
  border: "1px solid #d9d9d9",
  background: "#fff",
  borderRadius: 6,
  padding: "8px 10px",
  minHeight: 54,
  fontSize: 13,
  lineHeight: 1.35
};

const smallMetricBox: React.CSSProperties = {
  ...textBoxStyle,
  minHeight: 36,
  width: "100%",
  padding: "6px 8px",
  fontSize: 12
};

const roleCardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 16,
  marginBottom: 18,
  background: "#fafafa",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
};

const placeholderStyle: React.CSSProperties = {
  opacity: 0.45,
  fontStyle: "italic"
};

const inlineHeaderLine: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: 6
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  margin: "18px 0 10px"
};

interface DisplayRole extends Role {
  _placeholder: boolean;
}

const ProfileApp: React.FC = () => {
  // Form inputs
  const [candidateName, setCandidateName] = useState("");
  const [jobLink, setJobLink] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // IDs
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // Ingest workflow state
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Poll data
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // Poll interval refs
  const jobIntervalRef = useRef<number | null>(null);
  const snapshotIntervalRef = useRef<number | null>(null);

  // For logging transitions
  const pollAttemptJobRef = useRef(0);
  const pollAttemptSnapshotRef = useRef(0);
  const prevRolesCountRef = useRef<number>(0);
  const pollStartTimeRef = useRef<number | null>(null);
  const ingestRequestStartRef = useRef<number | null>(null);

  // Start ingest
  const handleStart = useCallback(async () => {
    console.log("[FE:action] start-ingest click", {
      candidateName: candidateName || null,
      jobLink: jobLink || null,
      hasFile: !!fileInputRef.current?.files?.[0],
      prevResumeId: resumeId,
      prevJobId: jobId,
      ts: Date.now()
    });

    setIngestError(null);
    setIngestLoading(true);
    try {
      const file = fileInputRef.current?.files?.[0] || null;
      const form = new FormData();
      if (file) form.append("resume_pdf", file);
      if (candidateName.trim()) form.append("candidate_name", candidateName.trim());
      if (jobLink.trim()) form.append("job_link", jobLink.trim());

      console.log("[FE:ingest] sending payload (no parsed roles on client)", {
        candidateName: candidateName.trim() || null,
        jobLink: jobLink.trim() || null,
        fileName: file?.name,
        fileSize: file?.size,
        ts: Date.now()
      });
      ingestRequestStartRef.current = performance.now();

      const resp = await fetch("/api/resumes/ingest", { method: "POST", body: form });
      const durationMs = ingestRequestStartRef.current != null
        ? Math.round(performance.now() - ingestRequestStartRef.current)
        : null;

      if (!resp.ok) {
        let msg = `HTTP ${resp.status}`;
        try {
          const errJson = await resp.json();
            if (errJson?.message) msg = errJson.message;
        } catch { /* ignore */ }
        console.error("[FE:ingest] error response", {
          status: resp.status,
          durationMs
        });
        throw new Error(msg);
      }
      const data = await resp.json();
      console.log("[FE:ingest] success", {
        resumeId: data.resumeId,
        jobId: data.jobId,
        durationMs
      });
      if (!data.resumeId || !data.jobId) throw new Error("Ingest response missing resumeId or jobId");
      setResumeId(data.resumeId);
      setJobId(data.jobId);
      setJobProgress(null);
      setSnapshot(null);
      prevRolesCountRef.current = 0;
    } catch (e: any) {
      console.error("[FE:ingest] failure", { message: e.message });
      setIngestError(e.message || "Failed to start ingest");
    } finally {
      setIngestLoading(false);
    }
  }, [candidateName, jobLink, resumeId, jobId]);

  // Poll job
  const pollJob = useCallback(async () => {
    if (!jobId) return;
    pollAttemptJobRef.current += 1;
    const attempt = pollAttemptJobRef.current;
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        console.warn("[FE:poll:job] non-ok response", { attempt, status: res.status });
        return;
      }
      const json = await res.json();
      console.log("[FE:poll:job] result", {
        attempt,
        status: json.status,
        completed_roles: json.completed_roles,
        total_roles: json.total_roles
      });
      setJobProgress(json);
    } catch (err) {
      console.error("[FE:poll:job] fetch error", { attempt, err });
    }
  }, [jobId]);

  // Poll snapshot
  const pollSnapshot = useCallback(async () => {
    if (!resumeId) return;
    pollAttemptSnapshotRef.current += 1;
    const attempt = pollAttemptSnapshotRef.current;
    try {
      const res = await fetch(`/api/resumes/${resumeId}/snapshot`);
      if (!res.ok) {
        console.warn("[FE:poll:snapshot] non-ok response", { attempt, status: res.status });
        return;
      }
      const json = await res.json();
      const rolesCount = json.roles?.length || 0;
      const firstRole = rolesCount ? json.roles[0] : null;
      const prev = prevRolesCountRef.current;
      if (rolesCount !== prev) {
        console.log("[FE:state] rolesCount change", { previous: prev, current: rolesCount, attempt });
        prevRolesCountRef.current = rolesCount;
      }
      console.log("[FE:poll:snapshot] summary", {
        attempt,
        rolesCount,
        firstRoleKeys: firstRole ? Object.keys(firstRole) : null
      });
      setSnapshot(json);
    } catch (err) {
      console.error("[FE:poll:snapshot] fetch error", { attempt, err });
    }
  }, [resumeId]);

  // Start intervals when IDs appear
  useEffect(() => {
    if (!resumeId || !jobId) return;
    pollStartTimeRef.current = performance.now();
    console.log("[FE:poll:init]", {
      resumeId,
      jobId,
      intervalMs: POLL_INTERVAL_MS,
      ts: Date.now()
    });
    pollJob();
    pollSnapshot();
    jobIntervalRef.current = window.setInterval(pollJob, POLL_INTERVAL_MS);
    snapshotIntervalRef.current = window.setInterval(pollSnapshot, POLL_INTERVAL_MS);
    return () => {
      console.log("[FE:poll:cleanup] clearing intervals (unmount or id change)");
      if (jobIntervalRef.current) window.clearInterval(jobIntervalRef.current);
      if (snapshotIntervalRef.current) window.clearInterval(snapshotIntervalRef.current);
      jobIntervalRef.current = null;
      snapshotIntervalRef.current = null;
    };
  }, [resumeId, jobId, pollJob, pollSnapshot]);

  // Stop polling after completion
  useEffect(() => {
    if (jobProgress?.status === "completed") {
      if (jobIntervalRef.current) window.clearInterval(jobIntervalRef.current);
      if (snapshotIntervalRef.current) window.clearInterval(snapshotIntervalRef.current);
      jobIntervalRef.current = null;
      snapshotIntervalRef.current = null;
      const totalDurationMs = pollStartTimeRef.current != null
        ? Math.round(performance.now() - pollStartTimeRef.current)
        : null;
      console.log("[FE:stop] job completed, stopping polling", {
        totalDurationMs,
        finalRolesCount: snapshot?.roles?.length || 0
      });
      // final snapshot fetch
      pollSnapshot();
    }
  }, [jobProgress, pollSnapshot, snapshot]);

  // Determine how many role modules to show:
  // Priority:
  // 1. snapshot.roles length (actual roles discovered)
  // 2. jobProgress.total_roles (expected)
  // 3. Minimum placeholder baseline
  const discoveredCount = snapshot?.roles?.length || 0;
  const expectedCount = jobProgress?.total_roles || 0;
  const roleCount = Math.max(
    MIN_BASE_PLACEHOLDERS,
    discoveredCount,
    expectedCount
  );

  // Organize snapshot roles by ordinal (fallback to index if missing)
  const snapshotRolesByOrdinal: Record<number, Role> = {};
  if (snapshot?.roles) {
    snapshot.roles
      .slice()
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
      .forEach((r, idx) => {
        const ord = typeof r.ordinal === "number" ? r.ordinal : idx;
        snapshotRolesByOrdinal[ord] = { ...r, ordinal: ord };
      });
  }

  // Build display roles
  const displayRoles: DisplayRole[] = Array.from({ length: roleCount }, (_, i) => {
    const sr = snapshotRolesByOrdinal[i];
    if (sr) return { ...sr, _placeholder: false };
    return {
      role_id: `placeholder-${i}`,
      ordinal: i,
      _placeholder: true
    };
  });

  // Log when roles become available for rendering
  useEffect(() => {
    if (snapshot?.roles?.length) {
      console.log("[FE:render] roles available", {
        count: snapshot.roles.length,
        firstRole: snapshot.roles[0]
      });
    }
  }, [snapshot?.roles]);

  const progressPercent = jobProgress
    ? jobProgress.total_roles === 0
      ? 0
      : Math.round((jobProgress.completed_roles / jobProgress.total_roles) * 100)
    : 0;

  const displayName =
    snapshot?.full_name?.trim()
    || (candidateName.trim() ? candidateName.trim() : "(Name pending)");

  const valOrPlaceholder = (
    val?: string | number | null,
    placeholder: string = "Pending"
  ) =>
    val !== undefined && val !== null && val !== ""
      ? <span>{val}</span>
      : <span style={placeholderStyle}>{placeholder}</span>;

  const renderRoleCard = (role: DisplayRole) => {
    const durationDisplay =
      typeof role.role_duration === "number" && role.role_duration > 0
        ? `${role.role_duration} mo`
        : null;

    const stars = [role.role_star_1, role.role_star_2, role.role_star_3];
    const metrics = [role.metric_1, role.metric_2, role.metric_3];

    return (
      <div key={role.role_id} style={roleCardStyle}>
        {/* Header line: role - company - duration */}
        <div style={inlineHeaderLine}>
          <span>
            {valOrPlaceholder(
              role.title,
              `Role Title${role._placeholder ? "" : ""}`
            )}
          </span>
            <span style={{ opacity: 0.5 }}>—</span>
          <span>{valOrPlaceholder(role.company, "Company")}</span>
          <span style={{ opacity: 0.5 }}>—</span>
          <span>
            {durationDisplay
              ? durationDisplay
              : <span style={placeholderStyle}>Duration</span>}
          </span>
        </div>

        {/* Role tags (seniority, role industry) */}
        <div style={{ marginTop: 8 }}>
          <span style={tagStyle}>
            {role.role_seniority || "Seniority"}
          </span>
          <span style={tagStyle}>
            {role.role_industry || "Role Industry"}
          </span>
        </div>

        {/* Company tags (size, industry) */}
        <div style={{ marginTop: 2 }}>
          <span style={tagStyle}>
            {role.company_size || "Company Size"}
          </span>
          <span style={tagStyle}>
            {role.company_industry || "Company Industry"}
          </span>
        </div>

        {/* Role Description */}
        <div style={{ marginTop: 14 }}>
          <div style={boxLabelStyle}>Role Description</div>
          <div style={textBoxStyle}>
            {role.role_description
              ? role.role_description
              : <span style={placeholderStyle}>Pending role description</span>}
          </div>
        </div>

        {/* STAR Stories */}
        <div style={{ marginTop: 14 }}>
          <div style={boxLabelStyle}>STAR Stories</div>
          {stars.map((s, i) => (
            <div
              key={i}
              style={{ ...textBoxStyle, marginBottom: 8, minHeight: 46 }}
            >
              {s
                ? s
                : <span style={placeholderStyle}>STAR Story {i + 1}</span>}
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div style={{ marginTop: 10 }}>
          <div style={boxLabelStyle}>Metrics</div>
          <div style={{ display: "flex", gap: 10 }}>
            {metrics.map((m, i) => (
              <div key={i} style={smallMetricBox}>
                {m ? m : <span style={placeholderStyle}>Metric {i + 1}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, Arial, sans-serif" }}>
      {/* LEFT: Profile / Roles */}
      <div
        style={{
          flex: 1.4,
            padding: "24px 28px 40px",
          borderRight: "1px solid #ccc",
          overflowY: "auto",
          background: "#f5f7fa"
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600 }}>{displayName}</h1>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            Resume ID: {resumeId ? resumeId : <span style={placeholderStyle}>—</span>}
          </div>
        </div>

        <h2 style={sectionTitleStyle}>Roles</h2>

        {displayRoles.map(renderRoleCard)}
      </div>

      {/* RIGHT: Controls */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <h1 style={{ marginTop: 0 }}>Controls</h1>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold" }}>Candidate Name</label>
          <input
            type="text"
            value={candidateName}
            onChange={e => setCandidateName(e.target.value)}
            placeholder="Name"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={ingestLoading}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold" }}>Resume (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            disabled={ingestLoading}
            style={{ marginTop: 4 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold" }}>Job Link</label>
          <input
            type="url"
            value={jobLink}
            onChange={e => setJobLink(e.target.value)}
            placeholder="https://example.com/job"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            disabled={ingestLoading}
          />
        </div>

        <button
          onClick={handleStart}
          disabled={ingestLoading}
          style={{
            padding: "10px 20px",
            backgroundColor: ingestLoading ? "#999" : "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: ingestLoading ? "default" : "pointer",
            fontSize: 15,
            fontWeight: 600
          }}
        >
          {ingestLoading ? "Starting..." : "Start"}
        </button>

        {ingestError && (
          <div style={{ marginTop: 16, color: "red" }}>Error: {ingestError}</div>
        )}

        {jobProgress && (
          <div style={{ marginTop: 32 }}>
            <h2 style={{ margin: "0 0 12px" }}>Progress</h2>
            <div style={{ fontSize: 14, marginBottom: 8 }}>
              Status: <strong>{jobProgress.status}</strong>
            </div>
            <div
              style={{
                height: 16,
                background: "#eee",
                borderRadius: 8,
                overflow: "hidden",
                marginBottom: 4
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  background: jobProgress.status === "completed" ? "#28a745" : "#007BFF",
                  height: "100%",
                  transition: "width 0.4s"
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#333" }}>
              {jobProgress.completed_roles} / {jobProgress.total_roles} roles enriched ({progressPercent}%)
            </div>
          </div>
        )}

        {(resumeId || jobId) && (
          <div style={{ marginTop: 28, fontSize: 12, opacity: 0.75 }}>
            <div>resumeId: {resumeId}</div>
            <div>jobId: {jobId}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileApp;