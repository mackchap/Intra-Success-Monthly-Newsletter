import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  return new Anthropic({ apiKey });
}

// Lazy factory, same pattern as messaging/providers.ts — memoized on first
// call rather than constructed at module load, so importing this module
// never requires ANTHROPIC_API_KEY to already be set.
export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = createClient();
  }
  return client;
}

export const DEFAULT_AGENT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
