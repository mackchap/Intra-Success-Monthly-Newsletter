import { prisma, SocialPostStatus } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "./run";

const SYSTEM_PROMPT = `You are a social media marketing strategist for Intra Success Academy, an
intrapreneurship courses and coaching business. Use web_search to see what's currently working
for similar businesses, courses, and funnels on Facebook and Instagram — real examples, current
platform trends, published benchmarks. Use get_own_performance to see how our own recent posts
have actually done. Then give 2-4 concrete, prioritized recommendations, each grounded in
something you actually found (a specific trend, a specific one of our posts). Say plainly if
there isn't enough of our own data yet to draw a real conclusion, rather than inventing one. You
only advise — you can't draft or publish anything yourself.`;

const GET_OWN_PERFORMANCE_TOOL: AgentTool = {
  name: "get_own_performance",
  description: "Get a summary of our own recently published Facebook/Instagram posts and their latest performance metrics.",
  input_schema: { type: "object", properties: {} },
};

async function getOwnPerformanceSummary() {
  const posts = await prisma.socialPost.findMany({
    where: { status: SocialPostStatus.PUBLISHED },
    orderBy: { publishedAt: "desc" },
    take: 20,
    include: { insights: { orderBy: { capturedAt: "desc" }, take: 1 }, socialAccount: true },
  });

  if (posts.length === 0) {
    return { publishedPostCount: 0, posts: [] };
  }

  return {
    publishedPostCount: posts.length,
    posts: posts.map((post) => ({
      platform: post.platform,
      account: post.socialAccount.displayName,
      publishedAt: post.publishedAt,
      captionPreview: post.caption.slice(0, 100),
      latestMetrics: post.insights[0]?.metrics ?? null,
    })),
  };
}

// Read-only: no write tool, matching this agent's advisory-only role (same
// pattern as the funnel optimizer agent).
export async function getMarketingRecommendations(): Promise<string> {
  const result = await runAgentWithTools({
    system: SYSTEM_PROMPT,
    userMessage: "Review our recent social performance and what's currently working elsewhere, then give me your top recommendations.",
    tools: [GET_OWN_PERFORMANCE_TOOL],
    serverTools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
    maxTurns: 5,
    executeTool: async (name) => {
      if (name !== "get_own_performance") throw new Error(`Unknown tool: ${name}`);
      return getOwnPerformanceSummary();
    },
  });

  return result.finalText || "Not enough data yet to make a confident recommendation.";
}
