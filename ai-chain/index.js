/**
 * ai-chain/index.js
 *
 * AI chain with primary/fallback model routing, retry logic,
 * and structured JSON output enforcement.
 *
 * Output schema (always):
 * {
 *   answer: string,
 *   confidence: "low" | "medium" | "high",
 *   sources: string[],   // incident numbers referenced
 *   model_used: string,
 *   fallback_triggered: boolean
 * }
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'claude-sonnet-4-20250514';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '2', 10);

const SYSTEM_PROMPT = `You are an expert IT support specialist with deep knowledge of enterprise infrastructure.

You will be given a user's IT issue and relevant context from past resolved incidents.

You MUST respond with valid JSON only — no preamble, no markdown, no explanation outside the JSON.

Response schema:
{
  "answer": "Clear, actionable resolution steps",
  "confidence": "low" | "medium" | "high",
  "sources": ["INC0001234", "INC0005678"],
  "reasoning": "Brief explanation of why this resolution applies"
}

Rules:
- Only reference incidents provided in context. Never invent incident numbers.
- Set confidence to "high" only if a past incident closely matches and has a clear resolution.
- Set confidence to "low" if no strong matches exist or the issue is ambiguous.
- Keep answer concise and actionable. Use numbered steps for multi-step resolutions.`;

/**
 * Sleep helper for retry backoff.
 */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Call a specific model with timeout and retry logic.
 * Throws on unrecoverable error.
 */
async function callModel(model, userMessage, attempt = 1) {
  try {
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)
      ),
    ]);

    const raw = response.content[0].text.trim();
    const parsed = JSON.parse(raw);
    return parsed;

  } catch (err) {
    const isRateLimit = err?.status === 429;
    const isServerError = err?.status >= 500;
    const isTimeout = err.message === 'Request timed out';
    const isRetryable = isRateLimit || isServerError || isTimeout;

    if (isRetryable && attempt < MAX_RETRIES) {
      const backoff = attempt * 1500;
      console.warn(`[AI Chain] ${model} attempt ${attempt} failed (${err.message}). Retrying in ${backoff}ms...`);
      await sleep(backoff);
      return callModel(model, userMessage, attempt + 1);
    }

    throw err;
  }
}

/**
 * Main entry point. Tries primary model, falls back to secondary on failure.
 *
 * query: string — the user's raw issue description
 * ragContext: string — formatted context from the RAG layer
 *
 * Returns the output schema object plus model_used and fallback_triggered.
 */
async function triage(query, ragContext) {
  const userMessage = `
Past resolved incidents for context:
${ragContext}

---

Current issue to triage:
${query}
`.trim();

  let fallbackTriggered = false;

  try {
    console.log(`[AI Chain] Calling primary model: ${PRIMARY_MODEL}`);
    const result = await callModel(PRIMARY_MODEL, userMessage);
    return { ...result, model_used: PRIMARY_MODEL, fallback_triggered: false };

  } catch (primaryErr) {
    console.error(`[AI Chain] Primary model failed: ${primaryErr.message}. Activating fallback.`);
    fallbackTriggered = true;

    try {
      console.log(`[AI Chain] Calling fallback model: ${FALLBACK_MODEL}`);
      const result = await callModel(FALLBACK_MODEL, userMessage);
      return { ...result, model_used: FALLBACK_MODEL, fallback_triggered: true };

    } catch (fallbackErr) {
      console.error(`[AI Chain] Fallback model also failed: ${fallbackErr.message}`);
      // Hard failure — return a safe degraded response
      return {
        answer: 'AI triage is temporarily unavailable. Please review the similar incidents above and contact your support team.',
        confidence: 'low',
        sources: [],
        reasoning: 'Both primary and fallback models failed to respond.',
        model_used: 'none',
        fallback_triggered: true,
        error: true,
      };
    }
  }
}

module.exports = { triage };
