import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, DEFAULT_AGENT_MODEL } from "./client";

export interface AgentTool {
  name: string;
  description: string;
  input_schema: Anthropic.Tool["input_schema"];
}

export interface AgentToolCall {
  name: string;
  input: unknown;
  result: unknown;
}

export interface RunAgentWithToolsInput {
  system: string;
  userMessage: string;
  // Prior turns of a multi-message conversation (student support chat), as
  // plain text pairs — prepended before userMessage. Omitted by the
  // single-shot agents (lead qualification, follow-up drafting).
  history?: Anthropic.MessageParam[];
  tools: AgentTool[];
  // Anthropic-hosted tools (e.g. web_search) that resolve server-side within
  // the same API response — never routed through executeTool, since there's
  // nothing for us to execute. Declared as raw objects rather than importing
  // an SDK type, since these tool definitions don't share the input_schema
  // shape custom tools do.
  serverTools?: Record<string, unknown>[];
  executeTool: (name: string, input: unknown) => Promise<unknown>;
  // Forces the given tool on the first turn only — useful for agents whose
  // whole job is "always call this one write tool" (e.g. lead qualification,
  // draft-email), rather than a free-form multi-turn chat.
  forceTool?: string;
  maxTurns?: number;
  model?: string;
}

export interface RunAgentWithToolsResult {
  finalText: string;
  toolCalls: AgentToolCall[];
}

// A minimal, provider-specific (Anthropic Messages API) tool-calling loop:
// send the conversation, execute any tool_use blocks the model returns, feed
// the results back as tool_result blocks, and repeat until the model stops
// calling tools or maxTurns is hit. Not meant to be a general agent
// framework — just enough for this app's four agents, each of which is a
// single-purpose loop over a small, fixed tool set.
export async function runAgentWithTools(input: RunAgentWithToolsInput): Promise<RunAgentWithToolsResult> {
  const maxTurns = input.maxTurns ?? 5;
  const messages: Anthropic.MessageParam[] = [...(input.history ?? []), { role: "user", content: input.userMessage }];
  const toolCalls: AgentToolCall[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await anthropic.messages.create({
      model: input.model ?? DEFAULT_AGENT_MODEL,
      max_tokens: 1024,
      system: input.system,
      tools: [...input.tools, ...(input.serverTools ?? [])] as Anthropic.MessageCreateParams["tools"],
      tool_choice: turn === 0 && input.forceTool ? { type: "tool", name: input.forceTool } : undefined,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
      return { finalText: textBlock?.text ?? "", toolCalls };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await input.executeTool(block.name, block.input);
      toolCalls.push({ name: block.name, input: block.input, result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });

    if (response.stop_reason !== "tool_use") {
      // Model called a tool but didn't set stop_reason to tool_use (shouldn't
      // normally happen) — treat this turn's tool results as the end state
      // rather than looping forever.
      return { finalText: "", toolCalls };
    }
  }

  return { finalText: "", toolCalls };
}
