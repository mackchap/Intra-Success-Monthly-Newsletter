import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      contact: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
      activity: { create: vi.fn() },
    },
  };
});

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "./run";
import { qualifyLead } from "./lead-qualification";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("qualifyLead", () => {
  it("does nothing if the contact no longer exists", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

    await qualifyLead("missing_contact");

    expect(runAgentWithTools).not.toHaveBeenCalled();
  });

  it("runs the agent with a forced record_qualification tool call, and the tool writes customFields/tags/Activity", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue({
      id: "contact_1",
      email: "lead@example.com",
      firstName: "Jane",
      lastName: null,
      phone: null,
      source: "funnel:funnel_1",
      tags: ["existing-tag"],
      deals: [],
    } as never);
    vi.mocked(prisma.contact.findUniqueOrThrow).mockResolvedValue({
      id: "contact_1",
      customFields: null,
      tags: ["existing-tag"],
    } as never);

    // Simulate the agent framework invoking executeTool with the forced call.
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("record_qualification", {
        score: 8,
        summary: "Strong intrapreneurship fit.",
        tags: ["high-intent"],
      });
      return { finalText: "Recorded.", toolCalls: [{ name: "record_qualification", input: {}, result }] };
    });

    await qualifyLead("contact_1");

    expect(runAgentWithTools).toHaveBeenCalledWith(
      expect.objectContaining({ forceTool: "record_qualification" }),
    );
    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: "contact_1" },
      data: {
        customFields: {
          aiQualification: {
            score: 8,
            summary: "Strong intrapreneurship fit.",
            tags: ["high-intent"],
            qualifiedAt: expect.any(String),
          },
        },
        tags: { set: ["existing-tag", "high-intent"] },
      },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: {
        type: "SYSTEM",
        contactId: "contact_1",
        metadata: { action: "ai_lead_qualification", score: 8, summary: "Strong intrapreneurship fit.", tags: ["high-intent"] },
      },
    });
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue({
      id: "contact_1",
      email: "lead@example.com",
      tags: [],
      deals: [],
    } as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_everything", {})).rejects.toThrow("Unknown tool");
      return { finalText: "", toolCalls: [] };
    });

    await qualifyLead("contact_1");
  });
});
