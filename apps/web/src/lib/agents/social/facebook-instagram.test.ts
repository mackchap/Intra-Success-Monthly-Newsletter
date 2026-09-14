import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      socialAccount: { findUniqueOrThrow: vi.fn() },
      socialPost: { create: vi.fn() },
    },
  };
});

vi.mock("../run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "../run";
import { draftSocialPost } from "./facebook-instagram";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("draftSocialPost", () => {
  it("creates a DRAFT SocialPost with hashtags appended to the caption", async () => {
    vi.mocked(prisma.socialAccount.findUniqueOrThrow).mockResolvedValue({
      id: "account_1",
      platform: "FACEBOOK",
    } as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("draft_post", {
        caption: "Ready to become an intrapreneur?",
        hashtags: ["intrapreneurship", "careergrowth"],
        imageBrief: "A confident professional presenting an idea in a meeting.",
      });
      return { finalText: "Drafted.", toolCalls: [{ name: "draft_post", input: {}, result }] };
    });

    vi.mocked(prisma.socialPost.create).mockResolvedValue({ id: "post_1" } as never);

    const draft = await draftSocialPost({
      campaignId: "campaign_1",
      socialAccountId: "account_1",
      brief: "Promote the new cohort starting next month.",
    });

    expect(prisma.socialPost.create).toHaveBeenCalledWith({
      data: {
        campaignId: "campaign_1",
        socialAccountId: "account_1",
        platform: "FACEBOOK",
        caption: "Ready to become an intrapreneur?\n\n#intrapreneurship #careergrowth",
        imageBrief: "A confident professional presenting an idea in a meeting.",
        status: "DRAFT",
      },
    });
    expect(draft).toEqual({
      postId: "post_1",
      caption: "Ready to become an intrapreneur?\n\n#intrapreneurship #careergrowth",
      imageBrief: "A confident professional presenting an idea in a meeting.",
    });
  });

  it("gives the agent both the draft_post tool and web_search as a server tool", async () => {
    vi.mocked(prisma.socialAccount.findUniqueOrThrow).mockResolvedValue({ id: "account_1", platform: "INSTAGRAM" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    await draftSocialPost({ campaignId: "c1", socialAccountId: "account_1", brief: "b" }).catch(() => {});

    const callArgs = vi.mocked(runAgentWithTools).mock.calls[0][0];
    expect(callArgs.tools.map((t) => t.name)).toEqual(["draft_post"]);
    expect(callArgs.serverTools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 3 }]);
  });

  it("throws if the agent never calls draft_post", async () => {
    vi.mocked(prisma.socialAccount.findUniqueOrThrow).mockResolvedValue({ id: "account_1", platform: "FACEBOOK" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "I couldn't decide on a caption.", toolCalls: [] });

    await expect(draftSocialPost({ campaignId: "c1", socialAccountId: "account_1", brief: "b" })).rejects.toThrow(
      "did not produce a draft post",
    );
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(prisma.socialAccount.findUniqueOrThrow).mockResolvedValue({ id: "account_1", platform: "FACEBOOK" } as never);
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_page", {})).rejects.toThrow("Unknown tool");
      return { finalText: "", toolCalls: [] };
    });

    await expect(draftSocialPost({ campaignId: "c1", socialAccountId: "account_1", brief: "b" })).rejects.toThrow(
      "did not produce a draft post",
    );
  });
});
