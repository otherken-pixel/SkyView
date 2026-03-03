const { onRequest } = require("firebase-functions/v2/https");

/**
 * anthropicProxy — secure backend proxy for the Anthropic Messages API.
 *
 * The frontend sends:
 *   POST /api/anthropic
 *   { model, max_tokens, system, messages }
 *
 * The function adds the secret API key server-side and forwards the
 * request to Anthropic, returning the JSON response verbatim.
 *
 * ANTHROPIC_API_KEY must be present in functions/.env (local emulation)
 * or set via: firebase functions:secrets:set ANTHROPIC_API_KEY (production).
 */
exports.anthropicProxy = onRequest(async (req, res) => {
  // ── CORS headers ──────────────────────────────────────────────────────────
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // ── Validate request body ─────────────────────────────────────────────────
  const { messages, system, model, max_tokens } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // ── Check API key is configured ───────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
    return;
  }

  // ── Build Anthropic payload ───────────────────────────────────────────────
  const payload = {
    model: model || "claude-3-5-sonnet-20241022",
    max_tokens: max_tokens || 1800,
    messages,
  };
  if (system) payload.system = system;

  // ── Forward to Anthropic ─────────────────────────────────────────────────
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: "Failed to reach Anthropic API: " + err.message });
  }
});
