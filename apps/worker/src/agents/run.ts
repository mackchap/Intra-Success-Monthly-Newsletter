import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_AGENT_MODEL } from "./client";

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
  tools: AgentTool[];
  executeTool: (name: string, input: unknown) => Promise<unknown>;
  // Forces the given tool on the first turn only — this worker only runs the
  // lead-qualification agent, which always calls record_qualification.
  forceTool?: string;
  maxTurns?: number;
  model?: string;
}

export interface RunAgentWithToolsResult {
  finalText: string;
  toolCalls: AgentToolCall[];
}

// Same minimal Anthropic Messages API tool-calling loop as
// apps/web/src/lib/agents/run.ts — duplicated rather than shared, since
// apps/web and apps/worker don't share code beyond @platform/db.
export async function runAgentWithTools(input: RunAgentWithToolsInput): Promise<RunAgentWithToolsResult> {
  const client = getAnthropicClient();
  const maxTurns = input.maxTurns ?? 5;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: input.userMessage }];
  const toolCalls: AgentToolCall[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: input.model ?? DEFAULT_AGENT_MODEL,
      max_tokens: 1024,
      system: input.system,
      tools: input.tools,
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
      return { finalText: "", toolCalls };
    }
  }

  return { finalText: "", toolCalls };
}
