import { getFunnelAnalytics } from "@/lib/funnels/analytics";
import { runAgentWithTools, type AgentTool } from "./run";

const SYSTEM_PROMPT = `You are a funnel optimization advisor for Intra Success Academy, an
intrapreneurship courses and coaching business. Use get_funnel_analytics to pull this funnel's
current step-by-step performance, then give 2-4 concrete, prioritized suggestions for improving
conversion and reducing drop-off, referencing the actual numbers you see. Don't suggest fixes for
steps that are already converting well, and say so plainly if there isn't enough traffic yet to
draw a conclusion. You only advise — you can't make changes to the funnel yourself.`;

const GET_ANALYTICS_TOOL: AgentTool = {
  name: "get_funnel_analytics",
  description: "Get this funnel's current step-by-step visit/conversion/revenue analytics.",
  input_schema: { type: "object", properties: {} },
};

// Read-only: no write tool, matching this agent's advisory-only role.
export async function getFunnelOptimizationAdvice(funnelId: string): Promise<string> {
  const result = await runAgentWithTools({
    system: SYSTEM_PROMPT,
    userMessage: `Analyze this funnel's performance and suggest improvements.`,
    tools: [GET_ANALYTICS_TOOL],
    maxTurns: 3,
    executeTool: async (name) => {
      if (name !== "get_funnel_analytics") throw new Error(`Unknown tool: ${name}`);
      return getFunnelAnalytics(funnelId);
    },
  });

  return result.finalText || "Not enough data to suggest anything yet.";
}
