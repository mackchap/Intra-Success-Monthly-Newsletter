import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("./client", () => ({
  getAnthropicClient: () => ({ messages: { create: createMock } }),
  DEFAULT_AGENT_MODEL: "claude-sonnet-5",
}));

import { runAgentWithTools } from "./run";

beforeEach(() => {
  createMock.mockReset();
});

describe("runAgentWithTools (worker)", () => {
  it("returns the model's text when it calls no tools", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "No qualification needed." }],
      stop_reason: "end_turn",
    });

    const result = await runAgentWithTools({
      system: "s",
      userMessage: "u",
      tools: [],
      executeTool: vi.fn(),
    });

    expect(result.finalText).toBe("No qualification needed.");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("executes a forced tool call on the first turn then returns follow-up text", async () => {
    createMock
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "record_qualification", input: { score: 7 } }],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Recorded." }],
        stop_reason: "end_turn",
      });

    const executeTool = vi.fn().mockResolvedValue({ ok: true });
    const result = await runAgentWithTools({
      system: "Qualify the lead.",
      userMessage: "New contact",
      tools: [{ name: "record_qualification", description: "d", input_schema: { type: "object" } }],
      executeTool,
      forceTool: "record_qualification",
    });

    expect(executeTool).toHaveBeenCalledWith("record_qualification", { score: 7 });
    expect(result.toolCalls).toEqual([{ name: "record_qualification", input: { score: 7 }, result: { ok: true } }]);
    expect(result.finalText).toBe("Recorded.");

    const firstCallArgs = createMock.mock.calls[0][0];
    expect(firstCallArgs.tool_choice).toEqual({ type: "tool", name: "record_qualification" });
  });
});
