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
  role_title?: string;
  company_name?: string;
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
const MIN_BASE_PLACEHOLDERS = 1;

/* ====== STYLES (VISUAL ONLY CHANGES) ====== */
const tagStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 999,
  background: "linear-gradient(90deg,#6366F1,#3B82F6)",
  color: "#fff",
  marginRight: 6,
  marginBottom: 6,
  border: "1px solid rgba(255,255,255,0.4)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
  letterSpacing: 0.3
};

const boxLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "#334155",
  marginBottom: 4,
  opacity: 0.85
};

const textBoxStyle: React.CSSProperties = {
  border: "1px solid #d0d7e2",
  background: "linear-gradient(135deg,#ffffff,#f1f5f9)",
  borderRadius: 10,
  padding: "10px 12px",
  minHeight: 54,
  fontSize: 13,
  lineHeight: 1.4,
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
};

const smallMetricBox: React.CSSProperties = {
  ...textBoxStyle,
  minHeight: 40,
  padding: "8px 10px"
};

const roleCardStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: 18,
  marginBottom: 22,
  background: "linear-gradient(145deg,#ffffff 0%,#f0f4ff 55%,#e0ecff 100%)",
  boxShadow: "0 4px 10px -2px rgba(30,41,59,0.15), 0 1px 3px rgba(0,0,0,0.08)",
  transition: "transform 0.25s ease, box-shadow 0.25s ease"
};

const placeholderStyle: React.CSSProperties = {
  opacity: 0.5,
  fontStyle: "italic"
};

const inlineHeaderLine: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  color: "#1e293b",
  letterSpacing: 0.2
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  margin: "18px 0 10px",
  letterSpacing: 0.5,
  color: "#1e293b"
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

  // Start ingest (LOGIC UNCHANGED)
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

  // Poll job (LOGIC UNCHANGED)
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

  // Poll snapshot (LOGIC UNCHANGED)
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

      console.log("[FE:poll:snapshot] FULL RESPONSE:", json);
      console.log("[FE:poll:snapshot] roles array:", json.roles);
      console.log("[FE:poll:snapshot] first role detail:", json.roles?.[0]);

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

  // Start intervals (LOGIC UNCHANGED)
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

  // Stop polling after completion (LOGIC UNCHANGED)
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
      pollSnapshot();
    }
  }, [jobProgress, pollSnapshot, snapshot]);

  // Snapshot roles normalization (LOGIC UNCHANGED)
  const snapshotRolesByOrdinal: Record<number, Role> = {};
  if (snapshot?.roles) {
    snapshot.roles.forEach((r, idx) => {
      const zeroIdx = (typeof r.ordinal === "number" ? r.ordinal - 1 : idx);
      const ord = zeroIdx < 0 ? 0 : zeroIdx;
      snapshotRolesByOrdinal[ord] = { ...r, ordinal: ord };
    });
  }

  console.log("[FE:debug] raw first snapshot role", snapshot?.roles?.[0]);

  const displayRoles: DisplayRole[] = (() => {
    const highestIdx = Object.keys(snapshotRolesByOrdinal).length
      ? Math.max(...Object.keys(snapshotRolesByOrdinal).map(n => Number(n)))
      : -1;
    const discoveredCount = Object.keys(snapshotRolesByOrdinal).length;
    const expectedCount = jobProgress?.total_roles || 0;

    const roleCount = Math.max(
      MIN_BASE_PLACEHOLDERS,
      discoveredCount,
      expectedCount,
      highestIdx + 1
    );

    return Array.from({ length: roleCount }, (_, i) => {
      const sr = snapshotRolesByOrdinal[i];
      if (sr) return { ...sr, _placeholder: false };
      return {
        role_id: `placeholder-${i}`,
        ordinal: i,
        _placeholder: true
      };
    });
  })();

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
        <div style={inlineHeaderLine}>
          <span>
            {valOrPlaceholder(
              role.role_title,
              `Role Title`
            )}
          </span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>{valOrPlaceholder(role.company_name, "Company")}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>
            {durationDisplay
              ? durationDisplay
              : <span style={placeholderStyle}>Duration</span>}
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap" }}>
          <span style={tagStyle}>
            {role.role_seniority || "Seniority"}
          </span>
          <span style={tagStyle}>
            {role.role_industry || "Role Industry"}
          </span>
        </div>

        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap" }}>
          <span style={tagStyle}>
            {role.company_size || "Company Size"}
          </span>
            <span style={tagStyle}>
            {role.company_industry || "Company Industry"}
          </span>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={boxLabelStyle}>Role Description</div>
          <div style={textBoxStyle}>
            {role.role_description
              ? role.role_description
              : <span style={placeholderStyle}>Pending role description</span>}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
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

        <div style={{ marginTop: 12 }}>
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

  /* ================= RENDER ================= */
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "Inter, Arial, sans-serif",
        background:
          "linear-gradient(120deg,#1e293b 0%, #0f172a 40%, #1e3a8a 100%)",
        color: "#0f172a"
      }}
    >
      {/* LEFT: Profile / Roles (structure unchanged, removed 'Roles' heading & resumeId text) */}
      <div
        style={{
          flex: 1.4,
          padding: "24px 28px 40px",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          overflowY: "auto",
          background:
            "linear-gradient(180deg,rgba(255,255,255,0.85) 0%,rgba(240,245,255,0.92) 60%,rgba(230,240,255,0.95) 100%)",
          backdropFilter: "blur(4px)"
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 600,
              background: "linear-gradient(90deg,#0f172a,#334155,#1e3a8a)",
              WebkitBackgroundClip: "text",
              color: "transparent",
              letterSpacing: 0.5
            }}
          >
            {displayName}
          </h1>
        </div>

        {/* (Removed explicit <h2>Roles) */}

        {displayRoles.map(renderRoleCard)}
      </div>

      {/* RIGHT: Controls (structure unchanged, removed heading text) */}
      <div
        style={{
          flex: 1,
          padding: 24,
          overflowY: "auto",
          background:
            "linear-gradient(180deg,rgba(15,23,42,0.55) 0%,rgba(30,41,59,0.6) 100%)",
          backdropFilter: "blur(6px)",
          color: "#f1f5f9",
          position: "relative"
        }}
      >
        {/* Removed <h1>Controls but kept spacing */}
        <div style={{ height: 4 }} />

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, letterSpacing: 0.5 }}>
            Candidate Name
          </label>
          <input
            type="text"
            value={candidateName}
            onChange={e => setCandidateName(e.target.value)}
            placeholder="Name"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginTop: 6,
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: 14,
              outline: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)"
            }}
            disabled={ingestLoading}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, letterSpacing: 0.5 }}>
            Resume (PDF)
          </label>
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            disabled={ingestLoading}
            style={{
              marginTop: 6,
              color: "#f8fafc"
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 600, fontSize: 13, letterSpacing: 0.5 }}>
            Job Link
          </label>
          <input
            type="url"
            value={jobLink}
            onChange={e => setJobLink(e.target.value)}
            placeholder="https://example.com/job"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginTop: 6,
              borderRadius: 10,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#f8fafc",
              fontSize: 14,
              outline: "none",
              boxShadow: "0 1px 2px rgba(0,0,0,0.4)"
            }}
            disabled={ingestLoading}
          />
        </div>

        <button
          onClick={handleStart}
          disabled={ingestLoading}
          style={{
            padding: "12px 26px",
            background: ingestLoading
              ? "linear-gradient(90deg,#64748b,#475569)"
              : "linear-gradient(90deg,#4f46e5,#3b82f6)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            cursor: ingestLoading ? "default" : "pointer",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0.5,
            boxShadow: "0 4px 14px -4px rgba(59,130,246,0.6), 0 2px 6px -1px rgba(30,41,59,0.5)",
            transition: "transform 0.2s, box-shadow 0.2s"
          }}
        >
          {ingestLoading ? "Starting..." : "Start"}
        </button>

        {ingestError && (
          <div style={{ marginTop: 18, color: "#f87171", fontWeight: 500 }}>
            Error: {ingestError}
          </div>
        )}

        {jobProgress && (
          <div style={{ marginTop: 38 }}>
            <h2
              style={{
                margin: "0 0 14px",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 0.6,
                background: "linear-gradient(90deg,#93c5fd,#e0f2fe)",
                WebkitBackgroundClip: "text",
                color: "transparent"
              }}
            >
              Progress
            </h2>
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              Status: <strong>{jobProgress.status}</strong>
            </div>
            <div
              style={{
                height: 18,
                background: "rgba(255,255,255,0.15)",
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 6,
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)"
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  background:
                    jobProgress.status === "completed"
                      ? "linear-gradient(90deg,#16a34a,#4ade80)"
                      : "linear-gradient(90deg,#6366f1,#3b82f6,#0ea5e9)",
                  height: "100%",
                  transition: "width 0.45s ease",
                  boxShadow: "0 0 6px rgba(59,130,246,0.7)"
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1", letterSpacing: 0.4 }}>
              {jobProgress.completed_roles} / {jobProgress.total_roles} roles enriched ({progressPercent}%)
            </div>
          </div>
        )}

        {/* Removed explicit resumeId / jobId output per request */}
      </div>
    </div>
  );
};

export default ProfileApp;