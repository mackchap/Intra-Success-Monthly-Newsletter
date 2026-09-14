import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      socialPost: { findMany: vi.fn() },
    },
  };
});

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "./run";
import { getMarketingRecommendations } from "./marketing-insights";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMarketingRecommendations", () => {
  it("summarizes published posts for the agent's get_own_performance tool", async () => {
    vi.mocked(prisma.socialPost.findMany).mockResolvedValue([
      {
        platform: "FACEBOOK",
        socialAccount: { displayName: "Intra Success Page" },
        publishedAt: new Date("2026-09-01"),
        caption: "Ready to become an intrapreneur? Join our next cohort today and start building the skills.",
        insights: [{ metrics: { reach: 500, likes: 20 } }],
      },
    ] as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("get_own_performance", {});
      expect(result).toEqual({
        publishedPostCount: 1,
        posts: [
          {
            platform: "FACEBOOK",
            account: "Intra Success Page",
            publishedAt: new Date("2026-09-01"),
            captionPreview: "Ready to become an intrapreneur? Join our next cohort today and start building the skills.",
            latestMetrics: { reach: 500, likes: 20 },
          },
        ],
      });
      return { finalText: "Post more consistently on Fridays.", toolCalls: [] };
    });

    const advice = await getMarketingRecommendations();

    expect(advice).toBe("Post more consistently on Fridays.");
  });

  it("reports zero published posts rather than erroring when there is no data yet", async () => {
    vi.mocked(prisma.socialPost.findMany).mockResolvedValue([]);
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("get_own_performance", {});
      expect(result).toEqual({ publishedPostCount: 0, posts: [] });
      return { finalText: "Not enough data yet — publish a few posts first.", toolCalls: [] };
    });

    await getMarketingRecommendations();
  });

  it("gives the agent both the performance tool and web_search as a server tool, with no write tool", async () => {
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "advice", toolCalls: [] });

    await getMarketingRecommendations();

    const callArgs = vi.mocked(runAgentWithTools).mock.calls[0][0];
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe("get_own_performance");
    expect(callArgs.serverTools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 4 }]);
    expect(callArgs.forceTool).toBeUndefined();
  });

  it("falls back to a friendly message when the agent produces no text", async () => {
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    const advice = await getMarketingRecommendations();

    expect(advice).toBe("Not enough data yet to make a confident recommendation.");
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_page", {})).rejects.toThrow("Unknown tool");
      return { finalText: "ok", toolCalls: [] };
    });

    await getMarketingRecommendations();
  });
});
