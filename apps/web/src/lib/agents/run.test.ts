import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  DEFAULT_AGENT_MODEL: "claude-sonnet-5",
}));

import { anthropic } from "./client";
import { runAgentWithTools } from "./run";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAgentWithTools", () => {
  it("returns the model's text when it calls no tools", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: "text", text: "Hello there." }],
      stop_reason: "end_turn",
    } as never);

    const executeTool = vi.fn();
    const result = await runAgentWithTools({
      system: "You are a helpful assistant.",
      userMessage: "Hi",
      tools: [],
      executeTool,
    });

    expect(result.finalText).toBe("Hello there.");
    expect(result.toolCalls).toEqual([]);
    expect(executeTool).not.toHaveBeenCalled();
    expect(anthropic.messages.create).toHaveBeenCalledTimes(1);
  });

  it("executes a tool call, feeds the result back, and returns the follow-up text", async () => {
    vi.mocked(anthropic.messages.create)
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "get_weather", input: { city: "Austin" } }],
        stop_reason: "tool_use",
      } as never)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "It's sunny in Austin." }],
        stop_reason: "end_turn",
      } as never);

    const executeTool = vi.fn().mockResolvedValue({ tempF: 90 });
    const result = await runAgentWithTools({
      system: "You are a weather assistant.",
      userMessage: "What's the weather in Austin?",
      tools: [{ name: "get_weather", description: "Get weather", input_schema: { type: "object" } }],
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledWith("get_weather", { city: "Austin" });
    expect(result.toolCalls).toEqual([{ name: "get_weather", input: { city: "Austin" }, result: { tempF: 90 } }]);
    expect(result.finalText).toBe("It's sunny in Austin.");
    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);

    const secondCallArgs = vi.mocked(anthropic.messages.create).mock.calls[1][0];
    expect(secondCallArgs.messages).toEqual([
      { role: "user", content: "What's the weather in Austin?" },
      { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "get_weather", input: { city: "Austin" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_1", content: '{"tempF":90}' }] },
    ]);
  });

  it("forces the named tool only on the first turn", async () => {
    vi.mocked(anthropic.messages.create)
      .mockResolvedValueOnce({
        content: [{ type: "tool_use", id: "tool_1", name: "record_qualification", input: { score: 8 } }],
        stop_reason: "tool_use",
      } as never)
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Done." }],
        stop_reason: "end_turn",
      } as never);

    await runAgentWithTools({
      system: "Qualify the lead.",
      userMessage: "New contact: Jane, interested in the intrapreneurship course.",
      tools: [{ name: "record_qualification", description: "Record it", input_schema: { type: "object" } }],
      executeTool: vi.fn().mockResolvedValue({ ok: true }),
      forceTool: "record_qualification",
    });

    const firstCallArgs = vi.mocked(anthropic.messages.create).mock.calls[0][0];
    const secondCallArgs = vi.mocked(anthropic.messages.create).mock.calls[1][0];
    expect(firstCallArgs.tool_choice).toEqual({ type: "tool", name: "record_qualification" });
    expect(secondCallArgs.tool_choice).toBeUndefined();
  });

  it("stops after maxTurns without an infinite loop", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: "tool_use", id: "tool_x", name: "loop_forever", input: {} }],
      stop_reason: "tool_use",
    } as never);

    const result = await runAgentWithTools({
      system: "s",
      userMessage: "u",
      tools: [{ name: "loop_forever", description: "d", input_schema: { type: "object" } }],
      executeTool: vi.fn().mockResolvedValue({}),
      maxTurns: 2,
    });

    expect(anthropic.messages.create).toHaveBeenCalledTimes(2);
    expect(result.finalText).toBe("");
  });

  it("prepends prior conversation history before the new user message", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: "text", text: "Sure, here's more detail." }],
      stop_reason: "end_turn",
    } as never);

    await runAgentWithTools({
      system: "s",
      userMessage: "Can you say more?",
      history: [
        { role: "user", content: "What is this course about?" },
        { role: "assistant", content: "It's about intrapreneurship." },
      ],
      tools: [],
      executeTool: vi.fn(),
    });

    const callArgs = vi.mocked(anthropic.messages.create).mock.calls[0][0];
    expect(callArgs.messages).toEqual([
      { role: "user", content: "What is this course about?" },
      { role: "assistant", content: "It's about intrapreneurship." },
      { role: "user", content: "Can you say more?" },
    ]);
  });

  it("merges serverTools alongside custom tools without routing them through executeTool", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [
        { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "current best practices" } },
        { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ title: "Result", url: "https://example.com" }] },
        { type: "text", text: "Based on current research, here's my answer." },
      ],
      stop_reason: "end_turn",
    } as never);

    const executeTool = vi.fn();
    const result = await runAgentWithTools({
      system: "s",
      userMessage: "What's trending?",
      tools: [{ name: "my_tool", description: "d", input_schema: { type: "object" } }],
      serverTools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      executeTool,
    });

    const callArgs = vi.mocked(anthropic.messages.create).mock.calls[0][0];
    expect(callArgs.tools).toEqual([
      { name: "my_tool", description: "d", input_schema: { type: "object" } },
      { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    ]);
    // The server tool already resolved within this same response — no
    // tool_use block for our loop to execute, so executeTool never runs.
    expect(executeTool).not.toHaveBeenCalled();
    expect(result.finalText).toBe("Based on current research, here's my answer.");
  });
});
