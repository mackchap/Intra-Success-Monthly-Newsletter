import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@platform/db", async () => {
  const actual = await vi.importActual<typeof import("@platform/db")>("@platform/db");
  return {
    ...actual,
    prisma: {
      course: { findUniqueOrThrow: vi.fn() },
      lesson: { findMany: vi.fn() },
    },
  };
});

vi.mock("./run", () => ({
  runAgentWithTools: vi.fn(),
}));

import { prisma } from "@platform/db";
import { runAgentWithTools } from "./run";
import { askStudentSupport } from "./student-support";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("askStudentSupport", () => {
  it("passes history and the new message, and returns the agent's final text", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ title: "Intrapreneurship 101" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "Great question!", toolCalls: [] });

    const answer = await askStudentSupport(
      "course_1",
      [
        { role: "user", content: "What is this course about?" },
        { role: "assistant", content: "It's about intrapreneurship." },
      ],
      "Can you say more?",
    );

    expect(answer).toBe("Great question!");
    expect(runAgentWithTools).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: "Can you say more?",
        history: [
          { role: "user", content: "What is this course about?" },
          { role: "assistant", content: "It's about intrapreneurship." },
        ],
      }),
    );
  });

  it("scopes search_course_content to the given courseId and returns matching lesson excerpts", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ title: "Intrapreneurship 101" } as never);
    vi.mocked(prisma.lesson.findMany).mockResolvedValue([
      { title: "What is intrapreneurship?", content: "Intrapreneurship is entrepreneurship inside a company." },
    ] as never);

    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      const result = await args.executeTool("search_course_content", { query: "intrapreneurship" });
      return { finalText: JSON.stringify(result), toolCalls: [] };
    });

    await askStudentSupport("course_1", [], "What is intrapreneurship?");

    expect(prisma.lesson.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ module: { courseId: "course_1" } }),
      }),
    );
  });

  it("returns a fallback message when the agent produces no text", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ title: "Intrapreneurship 101" } as never);
    vi.mocked(runAgentWithTools).mockResolvedValue({ finalText: "", toolCalls: [] });

    const answer = await askStudentSupport("course_1", [], "Anything?");

    expect(answer).toBe("I wasn't able to find an answer to that in this course.");
  });

  it("rejects an unknown tool name", async () => {
    vi.mocked(prisma.course.findUniqueOrThrow).mockResolvedValue({ title: "Intrapreneurship 101" } as never);
    vi.mocked(runAgentWithTools).mockImplementation(async (args) => {
      await expect(args.executeTool("delete_everything", {})).rejects.toThrow("Unknown tool");
      return { finalText: "ok", toolCalls: [] };
    });

    await askStudentSupport("course_1", [], "hi");
  });
});
