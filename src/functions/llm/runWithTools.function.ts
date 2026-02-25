import { LLMAbortableStream, LLMModelInfo, LLMProvider, NativeTool } from "../../types/llmProvider.interface";
import { Message } from "ollama";
import { executeTool, ToolbeltContext } from "./toolbeltExecutor.function";

const MAX_TOOL_TURNS = 10;

export interface RunWithToolsOptions {
  provider: LLMProvider;
  model: LLMModelInfo;
  messages: Message[];
  tools: NativeTool[];
  toolbeltCtx: ToolbeltContext;
  /**
   * Called before each follow-up LLM turn to re-resolve the full pipeline
   * from scratch (fresh file contents, sub-pipeline outputs, etc.).
   * The tool exchange from the current iteration is appended on top.
   */
  resolveMessages: () => Promise<Message[]>;
  /** Called when a new stream opens (so it can be stored for abort) */
  onStream: (stream: LLMAbortableStream) => void;
  /** Called with each streamed content chunk during the final (no-tool-calls) turn */
  onChunk: (text: string) => void;
  /** Called with each thinking chunk */
  onThinkChunk: (text: string) => void;
  /**
   * Called after each tool-call turn with a formatted summary of calls + results.
   */
  onToolTurnComplete: (formattedTurn: string) => void;
  /** Called with the clipboard accessor so tool context always reads current state */
  getClipboard: () => ToolbeltContext["clipboard"];
}

/**
 * Runs an agentic native tool-use loop:
 *   1. Stream the LLM response (with tools passed to the API).
 *   2. When the stream finishes, check final() for tool_calls.
 *   3. Execute each tool call and append { role: "tool" } result messages.
 *   4. Repeat until there are no more tool calls or MAX_TOOL_TURNS is reached.
 *
 * Falls back to a non-thinking request if the model rejects `think: true`.
 */
export async function runWithTools(
  options: RunWithToolsOptions,
): Promise<string> {
  const { provider, model, tools, toolbeltCtx, resolveMessages, onStream, onChunk, onThinkChunk, onToolTurnComplete, getClipboard } = options;

  // toolExchange accumulates the assistant+tool-result messages from this agentic session.
  // On each follow-up turn, fresh base messages are resolved and this exchange is appended.
  const toolExchange: Message[] = [];

  let finalOutput = "";
  let emittedFinal = false;

  async function streamOnce(messages: Message[], withThink: boolean): Promise<{ content: string; stream: LLMAbortableStream }> {
    const stream = await provider.chat({
      model: model.id,
      stream: true as const,
      ...(withThink ? { think: true } : {}),
      messages,
      tools,
    });
    onStream(stream);

    let content = "";
    for await (const chunk of stream) {
      if (chunk.thinking) {
        onThinkChunk(chunk.thinking);
      }
      if (chunk.content) {
        content += chunk.content;
      }
    }
    return { content, stream };
  }

  async function streamWithFallback(messages: Message[]): Promise<{ content: string; stream: LLMAbortableStream }> {
    try {
      return await streamOnce(messages, true);
    } catch (err: unknown) {
      const isThinkingError =
        err instanceof Error &&
        err.message.toLowerCase().includes("think");
      if (isThinkingError) {
        return await streamOnce(messages, false);
      }
      throw err;
    }
  }

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const baseMessages = turn === 0
      ? [...options.messages]
      : await resolveMessages();

    const messages = [...baseMessages, ...toolExchange];

    const { content: output, stream } = await streamWithFallback(messages);
    finalOutput = output;

    // Check for native tool calls in the assembled response
    const finalMeta = await stream.final();
    const nativeToolCalls = finalMeta.toolCalls ?? [];

    if (nativeToolCalls.length === 0) {
      // Final turn: no tool calls, emit directly to live display
      onChunk(output);
      emittedFinal = true;
      break;
    }

    // Execute all tool calls with a fresh clipboard snapshot
    const ctx: ToolbeltContext = {
      ...toolbeltCtx,
      clipboard: getClipboard(),
    };

    const resultLines: string[] = [];
    const callSummaryLines: string[] = [];

    for (const nativeCall of nativeToolCalls) {
      const result = await executeTool(nativeCall, ctx);
      resultLines.push(result);
      callSummaryLines.push(`[tool: ${nativeCall.name}] → ${result.slice(0, 120)}${result.length > 120 ? "…" : ""}`);
    }

    // Emit a readable summary of this tool turn to the display
    onToolTurnComplete(callSummaryLines.join("\n") + "\n");

    // Append the assistant's tool-call turn and results to the exchange.
    // Both Ollama and Mistral accept { role: "tool", content: "..." } result messages.
    // The assistant message must carry the tool_calls so the model knows what it did.
    toolExchange.push({
      role: "assistant",
      content: output,
      // Ollama accepts tool_calls on the assistant message
      tool_calls: nativeToolCalls.map((tc) => ({
        function: { name: tc.name, arguments: tc.args as Record<string, string> },
      })),
    } as Message);

    for (let i = 0; i < nativeToolCalls.length; i++) {
      toolExchange.push({ role: "tool", content: resultLines[i] } as Message);
    }

  }

  // If all turns contained tool calls and the loop exhausted MAX_TOOL_TURNS,
  // onChunk was never called — emit whatever we have so the display isn't empty.
  if (!emittedFinal && finalOutput) {
    onChunk(finalOutput);
  }

  return finalOutput;
}
