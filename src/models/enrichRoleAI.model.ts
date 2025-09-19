import OpenAI from "openai";

/**
 * Output of enrichment.
 */
export interface RoleEnrichment {
  role_description: string;
  star_stories: string[]; // length up to 3
  metrics: string[];      // length up to 3
}

/**
 * Minimal role shape required to construct a prompt.
 */
export interface RoleForAI {
  company_name: string;
  role_title: string;
  role_description: string;
  role_duration: number | null; // months
  company_industry: string | null;
  role_industry: string | null;
  role_seniority: string | null;
}

/**
 * Return stubbed enrichment (deterministic) when no API key or on failure.
 */
function buildStub(role: RoleForAI): RoleEnrichment {
  const baseDesc = role.role_description?.trim() || "(No original description)";
  return {
    role_description: baseDesc, // Keep original unmodified for now.
    star_stories: [
      `Delivered measurable improvements at ${role.company_name} as ${role.role_title}.`,
      `Collaborated cross-functionally to unblock key initiatives.`,
      `Applied structured problem solving to enhance team outcomes.`
    ],
    metrics: [
      "Improved efficiency by 20% (est.)",
      "Reduced turnaround time (qualitative)",
      "Increased reliability / stability (qualitative)"
    ]
  };
}

let openai: OpenAI | null = null;
const API_KEY = process.env.OPENAI_API_KEY;
if (API_KEY) {
  openai = new OpenAI({
    apiKey: API_KEY,
    timeout: 1000 * 60 * 5 // generous per-call timeout (5 min)
  });
}

/**
 * Build a concise instruction prompt. We request strict JSON output
 * so we can parse it reliably. Keep it stable / deterministic where possible.
 */
function buildPrompt(role: RoleForAI): string {
  const months = role.role_duration != null ? `${role.role_duration} month(s)` : "unknown duration";

  return `
You are an expert resume enhancer. You will receive a role record.
Leave the description alone.
Generate up to 3 STAR-format bullet stories from the description and up to 3 quant/qual metrics.
Return STRICT JSON only (no markdown, no commentary):

{
  "role_description": "...",
  "star_stories": ["...", "...", "..."],
  "metrics": ["...", "...", "..."]
}

Guidelines:
- Keep each STAR story <= 280 chars.
- Avoid repeating identical phrases.
- Metrics can be qualitative if no precise number is given; prefer plausible specifics but do NOT hallucinate precise proprietary data.
- NEVER include personally identifiable info beyond what is already given.
- If information is missing, infer responsibly but stay high-level.

ROLE INPUT:
Company Name: ${role.company_name}
Title: ${role.role_title}
Seniority: ${role.role_seniority || "(none)"}
Role Industry: ${role.role_industry || "(none)"}
Company Industry: ${role.company_industry || "(none)"}
Duration: ${months}
Original Description: ${role.role_description}
`.trim();
}

interface RawModelJSON {
  role_description?: string;
  star_stories?: string[];
  metrics?: string[];
}

/**
 * AI-based enrichment with safe fallback.
 */
export async function enrichRoleAI(role: RoleForAI): Promise<RoleEnrichment> {
  // Fast path: no API key => stub
  if (!openai) {
    return buildStub(role);
  }

  const prompt = buildPrompt(role);

  try {
    const response = await openai.responses.create({
      model: "o3", // adjust if you prefer a different model
      input: prompt,
      // If the SDK supports JSON mode in future, you can request it explicitly.
    });

    const raw = response.output_text?.trim();
    if (!raw) {
      return buildStub(role);
    }

    // Try to isolate JSON if model added commentary
    let jsonText = raw;
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonText = raw.slice(firstBrace, lastBrace + 1);
    }

    let parsed: RawModelJSON | null = null;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Fallback stub if JSON parse fails
      return buildStub(role);
    }

    // Sanitize / fallback each field
    if (!parsed) {
      return buildStub(role);
    }
    const desc = (parsed.role_description || role.role_description || "").trim();
    const stars = Array.isArray(parsed.star_stories) ? parsed.star_stories.slice(0, 3) : [];
    const metrics = Array.isArray(parsed.metrics) ? parsed.metrics.slice(0, 3) : [];

    return {
      role_description: desc || role.role_description || "",
      star_stories: stars.length ? stars : buildStub(role).star_stories,
      metrics: metrics.length ? metrics : buildStub(role).metrics
    };
  } catch (err) {
    console.error("[enrichRoleAI] AI call failed; using stub:", (err as any)?.message || err);
    return buildStub(role);
  }
}

export default enrichRoleAI;
