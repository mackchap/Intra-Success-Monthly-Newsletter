import { prisma, SocialPostStatus, SocialPlatform } from "@platform/db";
import { runAgentWithTools, type AgentTool } from "../run";

function buildSystemPrompt(platform: SocialPlatform): string {
  const platformNotes =
    platform === SocialPlatform.INSTAGRAM
      ? "Instagram posts always need an accompanying image or video — you cannot attach one yourself, so describe what it should show in imageBrief."
      : "Facebook Page posts can stand alone as text, but a relevant image usually performs better — suggest one in imageBrief if it would help.";

  return `You are a social media marketing specialist for Intra Success Academy, an
intrapreneurship courses and coaching business, writing a ${platform} post. Before drafting,
use web_search if you're unsure what's currently working well on ${platform} (algorithm
changes, format trends, hook styles) — don't rely purely on guesswork for anything
time-sensitive. ${platformNotes} Write copy that sounds like a real person, not an ad — specific
beats generic, and a genuine hook beats hype. When your caption is ready, call draft_post exactly
once. This is a DRAFT only: a staff member will review, edit, attach real media, and approve it
before anything is ever posted — you are not publishing anything yourself.`;
}

const DRAFT_POST_TOOL: AgentTool = {
  name: "draft_post",
  description: "Save a drafted social media post for staff review. Call this once, when your caption is finished.",
  input_schema: {
    type: "object",
    properties: {
      caption: { type: "string", description: "The full post caption/copy, ready to publish as written." },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "Relevant hashtags, without the # symbol.",
      },
      imageBrief: {
        type: "string",
        description: "A short description of what image or video should accompany this post.",
      },
    },
    required: ["caption", "imageBrief"],
  },
};

export interface DraftSocialPostInput {
  campaignId: string;
  socialAccountId: string;
  brief: string;
}

export interface DraftedSocialPost {
  postId: string;
  caption: string;
  imageBrief: string;
}

// Agent-only path to creating a SocialPost: it always lands in DRAFT, never
// further — publishing requires a separate, human-triggered approval step
// (see lib/social/publish.ts), matching the draft-and-approve convention
// every other agent in this app follows.
export async function draftSocialPost(input: DraftSocialPostInput): Promise<DraftedSocialPost> {
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: input.socialAccountId } });

  const result = await runAgentWithTools({
    system: buildSystemPrompt(account.platform),
    userMessage: `Draft a ${account.platform} post for this brief: ${input.brief}`,
    tools: [DRAFT_POST_TOOL],
    serverTools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    maxTurns: 6,
    executeTool: async (name, toolInput) => {
      if (name !== "draft_post") throw new Error(`Unknown tool: ${name}`);
      const { caption, hashtags, imageBrief } = toolInput as { caption: string; hashtags?: string[]; imageBrief: string };
      const fullCaption = hashtags && hashtags.length > 0 ? `${caption}\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}` : caption;

      const post = await prisma.socialPost.create({
        data: {
          campaignId: input.campaignId,
          socialAccountId: input.socialAccountId,
          platform: account.platform,
          caption: fullCaption,
          imageBrief,
          status: SocialPostStatus.DRAFT,
        },
      });

      return { postId: post.id, caption: fullCaption, imageBrief };
    },
  });

  const draftCall = result.toolCalls.find((call) => call.name === "draft_post");
  if (!draftCall) {
    throw new Error("The agent did not produce a draft post.");
  }
  return draftCall.result as DraftedSocialPost;
}
