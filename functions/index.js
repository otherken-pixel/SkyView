/**
 * FlightScore Cloud Functions
 *
 * geminiProxy — callable function that forwards requests to the Google
 * Gemini API.  Keeping the API key server-side means it is never exposed
 * in the browser bundle or developer tools.
 *
 * weatherProxy — callable function that fetches METAR/TAF data from
 * aviationweather.gov on the server side, bypassing browser CORS
 * restrictions and enabling global airport coverage.
 *
 * Set the key before deploying:
 *   firebase functions:secrets:set GEMINI_API_KEY
 * Or via environment config for the emulator:
 *   export GEMINI_API_KEY=...
 */

const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const https = require("https");

setGlobalOptions({ maxInstances: 10 });

// The Gemini key is stored as a Firebase Secret (never in source).
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * geminiProxy — Firebase callable function
 *
 * Accepts: { model, system, messages, max_tokens, temperature }
 *   - messages use Anthropic-style { role, content } for compatibility
 * Returns: { content: [{ text: "..." }] }  (normalised shape)
 *
 * Called from the browser via:
 *   const fn = httpsCallable(functions, 'geminiProxy');
 *   const result = await fn({ model, system, messages, max_tokens });
 */
exports.geminiProxy = onCall(
    { secrets: [geminiApiKey], cors: true, invoker: "public" },
    async (request) => {
        let key;
        try {
            key = geminiApiKey.value();
        } catch (secretErr) {
            logger.error("[geminiProxy] failed to read GEMINI_API_KEY secret", secretErr);
            throw new HttpsError("failed-precondition", "GEMINI_API_KEY secret is not configured. Run: firebase functions:secrets:set GEMINI_API_KEY");
        }
        if (!key) {
            throw new HttpsError("failed-precondition", "GEMINI_API_KEY secret is not set. Run: firebase functions:secrets:set GEMINI_API_KEY");
        }

        const { model, system, messages, max_tokens, temperature, thinkingBudget } = request.data || {};

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new HttpsError("invalid-argument", "messages must be a non-empty array.");
        }

        const geminiModel = model || "gemini-2.5-flash";

        // Convert Anthropic-style messages to Gemini format
        const contents = messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const generationConfig = {
            maxOutputTokens: max_tokens || 1800,
            temperature: temperature != null ? temperature : 0.0,
        };
        if (thinkingBudget != null) {
            generationConfig.thinkingConfig = { thinkingBudget };
        }
        const payload = {
            contents,
            generationConfig,
        };

        if (system) {
            payload.systemInstruction = { parts: [{ text: system }] };
        }

        const payloadStr = JSON.stringify(payload);

        logger.info("[geminiProxy] forwarding request", {
            model: geminiModel, max_tokens, messageCount: messages.length,
        });

        // Forward to Gemini via Node https (no external SDK dependency)
        return new Promise((resolve, reject) => {
            const options = {
                hostname: "generativelanguage.googleapis.com",
                path: `/v1beta/models/${geminiModel}:generateContent?key=${key}`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payloadStr),
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
                            logger.warn("[geminiProxy] Gemini error", { status: res.statusCode, msg });
                            reject(new HttpsError("internal", msg));
                        } else {
                            // Normalise to { content: [{ text }] }
                            const text = (data.candidates && data.candidates[0] &&
                                          data.candidates[0].content && data.candidates[0].content.parts &&
                                          data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || "";
                            resolve({ content: [{ text }] });
                        }
                    } catch (e) {
                        reject(new HttpsError("internal", "Failed to parse Gemini response."));
                    }
                });
            });

            req.on("error", (e) => {
                logger.error("[geminiProxy] network error", e);
                reject(new HttpsError("unavailable", e.message));
            });

            req.write(payloadStr);
            req.end();
        });
    }
);

/**
 * weatherProxy — Firebase callable function
 *
 * Fetches METAR or TAF data from aviationweather.gov on the server side,
 * bypassing browser CORS restrictions and providing global airport coverage.
 *
 * Accepts: { type: 'metar' | 'taf', icao: 'KJFK' }
 * Returns: JSON array from aviationweather.gov (passed through directly)
 *
 * Called from the browser via:
 *   const fn = httpsCallable(functions, 'weatherProxy');
 *   const result = await fn({ type: 'metar', icao: 'KJFK' });
 */
exports.weatherProxy = onCall(
    { cors: true, invoker: "public" },
    async (request) => {
        const { type, icao } = request.data || {};

        if (!icao || typeof icao !== "string") {
            throw new HttpsError("invalid-argument", "icao must be a non-empty string.");
        }

        // Sanitise ICAO: uppercase, alphanumeric only, 3-4 chars
        const cleanIcao = icao.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (cleanIcao.length < 3 || cleanIcao.length > 4) {
            throw new HttpsError("invalid-argument", "icao must be 3-4 alphanumeric characters.");
        }

        let url;
        if (type === "taf") {
            url = `https://aviationweather.gov/api/data/taf?ids=${cleanIcao}&format=json`;
        } else {
            // Default to METAR
            url = `https://aviationweather.gov/api/data/metar?ids=${cleanIcao}&format=json`;
        }

        logger.info("[weatherProxy] fetching", { type: type || "metar", icao: cleanIcao });

        return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let body = "";
                res.on("data", (chunk) => { body += chunk; });
                res.on("end", () => {
                    if (res.statusCode >= 400) {
                        logger.warn("[weatherProxy] upstream HTTP error", { status: res.statusCode, icao: cleanIcao });
                        reject(new HttpsError("unavailable", `aviationweather.gov returned HTTP ${res.statusCode}`));
                        return;
                    }
                    try {
                        const data = JSON.parse(body);
                        resolve(data);
                    } catch (e) {
                        logger.error("[weatherProxy] JSON parse error", { icao: cleanIcao, body: body.substring(0, 200) });
                        reject(new HttpsError("internal", "Failed to parse aviationweather.gov response."));
                    }
                });
            });

            req.on("error", (e) => {
                logger.error("[weatherProxy] network error", e);
                reject(new HttpsError("unavailable", e.message));
            });

            // 10-second timeout
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new HttpsError("deadline-exceeded", "aviationweather.gov request timed out."));
            });
        });
    }
);
