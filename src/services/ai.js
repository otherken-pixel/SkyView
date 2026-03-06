import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';

const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Call the Gemini API via the geminiProxy Firebase callable function.
 * Falls back to a direct API call if an apiKey is provided.
 *
 * @param {Object} params
 * @param {string} params.system - System instruction
 * @param {Array<{role: string, parts: Array<{text: string}>}>} params.messages - Conversation messages
 * @param {number} [params.max_tokens=2048] - Maximum output tokens
 * @param {number} [params.thinkingBudget] - Optional thinking budget for the model
 * @param {string} [params.apiKey] - Optional direct API key for fallback
 * @returns {Promise<string>} The model's text response
 */
export async function callGeminiApi({ system, messages, max_tokens = 2048, thinkingBudget, apiKey }) {
  // Try Firebase callable first
  if (!apiKey) {
    try {
      const geminiProxy = httpsCallable(functions, 'geminiProxy');
      const result = await geminiProxy({
        model: GEMINI_MODEL,
        system,
        messages,
        max_tokens,
        thinkingBudget,
      });
      return result.data?.text || result.data;
    } catch (err) {
      console.error('[callGeminiApi] Firebase callable failed:', err.message);
      throw err;
    }
  }

  // Fallback: direct Gemini API call
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents: messages,
    generationConfig: {
      maxOutputTokens: max_tokens,
    },
  };

  if (thinkingBudget != null) {
    body.generationConfig.thinkingConfig = { thinkingBudget };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  return candidate?.content?.parts?.map((p) => p.text).join('') || '';
}

/**
 * Call the Gemini API with streaming (direct API only).
 *
 * @param {Object} params
 * @param {string} params.system - System instruction
 * @param {Array<{role: string, parts: Array<{text: string}>}>} params.messages - Conversation messages
 * @param {number} [params.max_tokens=2048] - Maximum output tokens
 * @param {string} params.apiKey - Gemini API key (required for streaming)
 * @param {(chunk: string) => void} params.onChunk - Callback invoked for each text chunk
 * @returns {Promise<string>} The complete assembled response text
 */
export async function callGeminiApiStreaming({ system, messages, max_tokens = 2048, apiKey, onChunk }) {
  if (!apiKey) {
    throw new Error('An API key is required for streaming Gemini requests.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents: messages,
    generationConfig: {
      maxOutputTokens: max_tokens,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini streaming error ${res.status}: ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE format: each event starts with "data: " and ends with double newline
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text) {
              fullText += part.text;
              if (onChunk) onChunk(part.text);
            }
          }
        }
      } catch {
        // Partial JSON in buffer — will be completed on next read
      }
    }
  }

  return fullText;
}
