/**
 * FlightScore Cloud Functions
 *
 * anthropicProxy — callable function that forwards requests to the Anthropic
 * Messages API.  Keeping the API key server-side means it is never exposed
 * in the browser bundle or developer tools.
 *
 * Set the key before deploying:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 * Or via environment config for the emulator:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 */

const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const https = require("https");

setGlobalOptions({ maxInstances: 10 });

// The Anthropic key is stored as a Firebase Secret (never in source).
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

/**
 * anthropicProxy — Firebase callable function
 *
 * Accepts: { model, system, messages, max_tokens, stream }
 * Returns: { content: [{ text: "..." }] }  (same shape as Anthropic's API)
 *
 * Called from the browser via:
 *   const fn = httpsCallable(functions, 'anthropicProxy');
 *   const result = await fn({ model, system, messages, max_tokens });
 */
exports.anthropicProxy = onCall(
    { secrets: [anthropicApiKey], cors: true, invoker: "public" },
    async (request) => {
        let key;
        try {
            key = anthropicApiKey.value();
        } catch (secretErr) {
            logger.error("[anthropicProxy] failed to read ANTHROPIC_API_KEY secret", secretErr);
            throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY secret is not configured. Run: firebase functions:secrets:set ANTHROPIC_API_KEY");
        }
        if (!key) {
            throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY secret is not set. Run: firebase functions:secrets:set ANTHROPIC_API_KEY");
        }

        const { model, system, messages, max_tokens } = request.data || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new HttpsError("invalid-argument", "messages must be a non-empty array.");
        }

        const payload = JSON.stringify({
            model: model || "claude-3-5-sonnet-20241022",
            max_tokens: max_tokens || 1800,
            system: system || "",
            messages,
        });

        logger.info("[anthropicProxy] forwarding request", {
            model, max_tokens, messageCount: messages.length,
        });

        // Forward to Anthropic via Node https (no external SDK dependency)
        return new Promise((resolve, reject) => {
            const options = {
                hostname: "api.anthropic.com",
                path: "/v1/messages",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Length": Buffer.byteLength(payload),
                },
            };

            const req = https.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => { body += chunk; });
                res.on("end", () => {
                    try {
                        const data = JSON.parse(body);
                        if (res.statusCode >= 400) {
                            const msg = (data.error && data.error.message) || `HTTP ${res.statusCode}`;
                            logger.warn("[anthropicProxy] Anthropic error", { status: res.statusCode, msg });
                            reject(new HttpsError("internal", msg));
                        } else {
                            resolve({ content: data.content });
                        }
                    } catch (e) {
                        reject(new HttpsError("internal", "Failed to parse Anthropic response."));
                    }
                });
            });

            req.on("error", (e) => {
                logger.error("[anthropicProxy] network error", e);
                reject(new HttpsError("unavailable", e.message));
            });

            req.write(payload);
            req.end();
        });
    }
);
