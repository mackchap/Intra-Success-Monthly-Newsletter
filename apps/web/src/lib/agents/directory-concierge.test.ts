import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      directory: { findUniqueOrThrow: vi.fn() },
      listing: { findMany: vi.fn() },
    },
  };
});

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "./run";
import { askDirectoryConcierge } from "./directory-concierge";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("askDirectoryConcierge", () => {
  it("passes history and the new message, and returns the agent's final text", async () => {
    vi.mocked(prisma.directory.findUniqueOrThrow).mockResolvedValue({ name: "Main Street Directory" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "Try Joe's Diner!", toolCalls: [] });

    const answer = await askDirectoryConcierge(
      "dir_1",
      [
        { role: "user", content: "Any good coffee shops?" },
        { role: "assistant", content: "Yes, a few." },
      ],
      "Which one is closest to Main St?",
    );

    expect(answer).toBe("Try Joe's Diner!");
    expect(runAgentWithTools).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "Which one is closest to Main St?",
        history: [
          { role: "user", content: "Any good coffee shops?" },
          { role: "assistant", content: "Yes, a few." },
        ],
      }),
    );
  });

  it("scopes search_listings to the given directoryId and only PUBLISHED listings", async () => {
    vi.mocked(prisma.directory.findUniqueOrThrow).mockResolvedValue({ name: "Main Street Directory" } as never);
    vi.mocked(prisma.listing.findMany).mockResolvedValue([
      { name: "Joe's Diner", category: { name: "Restaurants" }, city: "Springfield", description: "Classic diner food." },
    ] as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("search_listings", { query: "diner" });
      return { finalText: JSON.stringify(result), toolCalls: [] };
    });

    await askDirectoryConcierge("dir_1", [], "Any diners?");

    expect(prisma.listing.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ directoryId: "dir_1", status: "PUBLISHED" }),
      }),
    );
  });

  it("returns a fallback message when the agent produces no text", async () => {
    vi.mocked(prisma.directory.findUniqueOrThrow).mockResolvedValue({ name: "Main Street Directory" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    const answer = await askDirectoryConcierge("dir_1", [], "Anything?");

    expect(answer).toBe("I wasn't able to find a good match for that in this directory.");
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(prisma.directory.findUniqueOrThrow).mockResolvedValue({ name: "Main Street Directory" } as never);
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_everything", {})).rejects.toThrow("Unknown tool");
      return { finalText: "ok", toolCalls: [] };
    });

    await askDirectoryConcierge("dir_1", [], "hi");
  });
});
