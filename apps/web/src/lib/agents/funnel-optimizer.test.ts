import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/funnels/analytics", () => ({
  getFunnelAnalytics: vi.fn(),
}));

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { getFunnelAnalytics } from "@/lib/funnels/analytics";
import { runAgentWithTools } from "./run";
import { getFunnelOptimizationAdvice } from "./funnel-optimizer";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFunnelOptimizationAdvice", () => {
  it("calls get_funnel_analytics scoped to the funnel and returns the agent's advice", async () => {
    const analytics = { funnelId: "funnel_1", steps: [], totalLeads: 0, paidOrders: 0, revenueCents: 0 };
    vi.mocked(getFunnelAnalytics).mockResolvedValue(analytics as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("get_funnel_analytics", {});
      expect(result).toBe(analytics);
      return { finalText: "Your opt-in step is converting well; focus on the offer step.", toolCalls: [] };
    });

    const advice = await getFunnelOptimizationAdvice("funnel_1");

    expect(getFunnelAnalytics).toHaveBeenCalledWith("funnel_1");
    expect(advice).toBe("Your opt-in step is converting well; focus on the offer step.");
    // No write tool offered — advisory only.
    const callArgs = vi.mocked(runAgentWithTools).mock.calls[0][0];
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.forceTool).toBeUndefined();
  });

  it("falls back to a friendly message when the agent produces no text", async () => {
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    const advice = await getFunnelOptimizationAdvice("funnel_1");

    expect(advice).toBe("Not enough data to suggest anything yet.");
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_funnel", {})).rejects.toThrow("Unknown tool");
      return { finalText: "ok", toolCalls: [] };
    });

    await getFunnelOptimizationAdvice("funnel_1");
  });
});
