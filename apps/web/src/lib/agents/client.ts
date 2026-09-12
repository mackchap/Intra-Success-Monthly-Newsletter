import Anthropic from "@anthropic-ai/sdk";

declare global {
  // eslint-disable-next-line no-var
  var __anthropic: Anthropic | undefined;
}

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const client = new Anthropic({ apiKey });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__anthropic = client;
  }
  return client;
}

// Lazy, same rationale as lib/stripe.ts: Next.js evaluates route modules
// during build-time page-data collection, before .env is loaded for that
// step, so an eager `new Anthropic(...)` at import time breaks the build.
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    const client = globalThis.__anthropic ?? createClient();
    return Reflect.get(client, prop);
  },
});

export const DEFAULT_AGENT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
