// Netlify Function: dispatches a task to any one of the AI Grant Team agents.
// Server-side only — ANTHROPIC_API_KEY never reaches the browser.
// POST body: { agent: "scout"|"eligibility"|..., input: "free text", workspace: {...} }

const { AGENTS } = require("./agents");

// Current Anthropic model string. Update here if the model is ever retired.
// Override without code changes by setting ANTHROPIC_MODEL in Netlify env vars.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server missing ANTHROPIC_API_KEY. Add it in Netlify environment variables." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { agent, input = "", workspace = {} } = body;
  const def = AGENTS[agent];
  if (!def) return { statusCode: 400, body: JSON.stringify({ error: "Unknown agent: " + agent }) };

  // Build context from the shared workspace so agents hand off to each other.
  // Cap each context piece so later pipeline agents don't blow the token budget.
  const cap = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) + "\n…[truncated]" : s);
  const ctxParts = [];
  if (workspace.grant) ctxParts.push("SELECTED GRANT:\n" + JSON.stringify(workspace.grant, null, 2));
  if (workspace.metrics) ctxParts.push("TRACKED OUTCOME METRICS:\n" + JSON.stringify(workspace.metrics, null, 2));
  if (workspace.period) ctxParts.push("REPORTING PERIOD: " + workspace.period);
  if (workspace.eligibility) ctxParts.push("ELIGIBILITY FINDINGS:\n" + cap(workspace.eligibility, 1500));
  if (workspace.research) ctxParts.push("RESEARCH DATA:\n" + cap(workspace.research, 2500));
  if (workspace.impact) ctxParts.push("IMPACT / KPIs:\n" + cap(workspace.impact, 1500));
  if (workspace.proposal) ctxParts.push("CURRENT PROPOSAL DRAFT:\n" + cap(workspace.proposal, 2500));
  if (workspace.budget) ctxParts.push("BUDGET:\n" + cap(workspace.budget, 1500));
  const context = ctxParts.length ? "\n\n--- SHARED WORKSPACE CONTEXT ---\n" + ctxParts.join("\n\n") : "";

  const userPrompt = `${input || "Proceed using the workspace context."}${context}`;

  const reqBody = {
    model: MODEL,
    max_tokens: 2000,
    system: def.system,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (def.web) reqBody.tools = [{ type: "web_search_20250305", name: "web_search" }];

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(reqBody),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data.error?.message || "Anthropic API error" }) };
    }
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");

    let parsed = null;
    if (def.json) {
      const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const candidates = [clean.indexOf("{"), clean.indexOf("[")].filter((i) => i >= 0);
      if (candidates.length) {
        const s = Math.min(...candidates);
        const isArr = clean[s] === "[";
        const e = isArr ? clean.lastIndexOf("]") : clean.lastIndexOf("}");
        if (e > s) {
          try { parsed = JSON.parse(clean.slice(s, e + 1)); }
          catch { parsed = null; }
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent, label: def.label, text, parsed }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
