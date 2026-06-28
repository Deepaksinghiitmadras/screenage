/**
 * AI Provider abstraction for Screenage.
 *
 * Supports multiple LLM backends via the AI_PROVIDER environment variable:
 *   - "gemini"  (default) – Google Gemini REST API
 *   - "groq"    – Groq (OpenAI-compatible, very fast Llama models)
 *   - "minimax" – MiniMax (OpenAI-compatible)
 *   - "siray"   – Siray.ai (OpenAI-compatible)
 *
 * Each provider returns a plain-text string from the model.
 */

export type AIProviderName = "gemini" | "groq" | "minimax" | "siray";

export interface AIProviderConfig {
  name: AIProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Resolve the provider configuration from environment variables.
 */
export function getProviderConfig(
  provider?: AIProviderName
): AIProviderConfig {
  const name =
    provider ||
    (process.env.AI_PROVIDER as AIProviderName) ||
    "gemini";

  switch (name) {
    case "groq":
      return {
        name: "groq",
        apiKey: process.env.GROQ_API_KEY || "",
        baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      };

    case "minimax":
      return {
        name: "minimax",
        apiKey: process.env.MINIMAX_API_KEY || "",
        baseUrl:
          process.env.MINIMAX_BASE_URL || "https://api.minimax.io/v1",
        model: process.env.MINIMAX_MODEL || "MiniMax-M2.7",
      };

    case "siray":
      return {
        name: "siray",
        apiKey: process.env.SIRAY_API_KEY || "",
        baseUrl: "https://api.siray.ai/v1",
        model: "siray-1.0-ultra",
      };

    case "gemini":
    default:
      return {
        name: "gemini",
        apiKey: process.env.GEMINI_API_KEY || "",
        baseUrl:
          "https://generativelanguage.googleapis.com/v1beta/models",
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
      };
  }
}

/**
 * Whether a provider has its API key configured.
 */
export function hasProviderKey(name: AIProviderName): boolean {
  switch (name) {
    case "gemini":
      return !!process.env.GEMINI_API_KEY;
    case "groq":
      return !!process.env.GROQ_API_KEY;
    case "minimax":
      return !!process.env.MINIMAX_API_KEY;
    case "siray":
      return !!process.env.SIRAY_API_KEY;
    default:
      return false;
  }
}

/**
 * Build the ordered list of providers to try: the configured primary first,
 * then the remaining providers that have keys. Providers without keys are
 * skipped so we never throw a missing-key error mid-chain.
 */
export function getProviderChain(): AIProviderName[] {
  const primary =
    (process.env.AI_PROVIDER as AIProviderName) || "groq";
  // Preferred order: Groq first (fast + cheap), then Gemini, then others.
  const order: AIProviderName[] = [primary, "groq", "gemini", "minimax", "siray"];
  const chain: AIProviderName[] = [];
  const seen = new Set<AIProviderName>();
  for (const p of order) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (hasProviderKey(p)) chain.push(p);
  }
  return chain;
}

// ── Provider call implementations ──────────────────────────────────

async function callGemini(
  prompt: string,
  config: AIProviderConfig
): Promise<string> {
  if (!config.apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `${config.baseUrl}/${config.model}:generateContent?key=${config.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty response");
  return text;
}

async function callOpenAICompatible(
  prompt: string,
  config: AIProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      `${config.name.toUpperCase()}_API_KEY is not set`
    );
  }

  const url = `${config.baseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `${config.name} API error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${config.name} returned empty response`);
  }
  return text;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Call the configured (or specified) AI provider and return the model
 * response as a plain string.
 */
export async function callAIProvider(
  prompt: string,
  provider?: AIProviderName
): Promise<string> {
  const config = getProviderConfig(provider);

  if (config.name === "gemini") {
    return callGemini(prompt, config);
  }
  // MiniMax and Siray both use OpenAI-compatible endpoints
  return callOpenAICompatible(prompt, config);
}

/**
 * Call the AI provider with automatic fallback across all configured providers.
 * Tries each provider in the chain until one succeeds.
 */
export async function callAIProviderWithFallback(
  prompt: string
): Promise<string> {
  const chain = getProviderChain();
  if (chain.length === 0) {
    throw new Error(
      "No AI provider configured. Set GEMINI_API_KEY, GROQ_API_KEY, MINIMAX_API_KEY or SIRAY_API_KEY."
    );
  }

  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    try {
      return await callAIProvider(prompt, name);
    } catch (err) {
      lastError = err;
      const next = chain[i + 1];
      console.error(
        next
          ? `⚠️ ${name} failed, switching to ${next} fallback`
          : `⚠️ ${name} failed (no more fallbacks)`,
        err
      );
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("All AI providers failed");
}
