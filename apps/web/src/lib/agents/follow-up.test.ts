import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      contact: { findUniqueOrThrow: vi.fn() },
    },
  };
});

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "./run";
import { draftFollowUpEmail } from "./follow-up";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("draftFollowUpEmail", () => {
  it("returns the drafted subject/body from the forced tool call", async () => {
    vi.mocked(prisma.contact.findUniqueOrThrow).mockResolvedValue({
      id: "contact_1",
      email: "lead@example.com",
      firstName: "Jane",
      lastName: null,
      deals: [{ title: "Intrapreneurship Course", status: "OPEN" }],
      notes: [{ body: "Asked about payment plans." }],
      activities: [{ type: "FUNNEL_SUBMISSION", createdAt: new Date() }],
    } as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("save_draft_email", {
        subject: "Following up on your interest",
        body: "Hi Jane, just checking in...",
      });
      return { finalText: "", toolCalls: [{ name: "save_draft_email", input: {}, result }] };
    });

    const draft = await draftFollowUpEmail("contact_1");

    expect(draft).toEqual({ subject: "Following up on your interest", body: "Hi Jane, just checking in..." });
    expect(runAgentWithTools).toHaveBeenCalledWith(expect.objectContaining({ forceTool: "save_draft_email" }));
  });

  it("throws if the agent never produces a draft", async () => {
    vi.mocked(prisma.contact.findUniqueOrThrow).mockResolvedValue({
      id: "contact_1",
      email: "lead@example.com",
      firstName: null,
      lastName: null,
      deals: [],
      notes: [],
      activities: [],
    } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    await expect(draftFollowUpEmail("contact_1")).rejects.toThrow("did not produce a draft email");
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(prisma.contact.findUniqueOrThrow).mockResolvedValue({
      id: "contact_1",
      email: "lead@example.com",
      firstName: null,
      lastName: null,
      deals: [],
      notes: [],
      activities: [],
    } as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_everything", {})).rejects.toThrow("Unknown tool");
      return { finalText: "", toolCalls: [] };
    });

    await expect(draftFollowUpEmail("contact_1")).rejects.toThrow("did not produce a draft email");
  });
});
