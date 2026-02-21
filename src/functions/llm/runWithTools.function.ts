import { AbortableAsyncIterator, ChatResponse, Message, Ollama, ModelResponse } from "ollama";
import { parseToolCalls, executeTool, ToolbeltContext } from "./toolbeltExecutor.function";

const MAX_TOOL_TURNS = 10;

export interface RunWithToolsOptions {
  ollama: Ollama;
  model: ModelResponse;
  messages: Message[];
  toolbeltCtx: ToolbeltContext;
  /**
   * Called before each follow-up LLM turn to re-resolve the full pipeline
   * from scratch (fresh file contents, sub-pipeline outputs, etc.).
   * The tool exchange from the current iteration is appended on top.
   */
  resolveMessages: () => Promise<Message[]>;
  /** Called when a new stream opens (so it can be stored for abort) */
  onStream: (stream: AbortableAsyncIterator<ChatResponse>) => void;
  /** Called with each streamed content chunk */
  onChunk: (text: string) => void;
  /** Called with each thinking chunk */
  onThinkChunk: (text: string) => void;
  /** Called before each tool-call round-trip with a status line like "[readFile: notes.txt]" */
  onToolStatus: (status: string) => void;
}

/**
 * Runs an agentic tool-use loop:
 *   1. Stream the LLM response.
 *   2. If the output contains <tool> calls, execute them and append
 *      the results as a new user message, then repeat.
 *   3. Stop when there are no more tool calls or MAX_TOOL_TURNS is reached.
 *
 * Falls back to a non-thinking request if the model rejects `think: true`.
 */
export async function runWithTools(
  options: RunWithToolsOptions,
): Promise<string> {
  const { ollama, model, toolbeltCtx, resolveMessages, onStream, onChunk, onThinkChunk, onToolStatus } = options;

  // toolExchange accumulates the assistant+tool-result pairs from this agentic session.
  // On each follow-up turn, fresh base messages are resolved and this exchange is appended.
  const toolExchange: Message[] = [];

  let finalOutput = "";

  async function streamOnce(messages: Message[], withThink: boolean): Promise<string> {
    const stream = await ollama.chat({
      model: model.model,
      stream: true as const,
      ...(withThink ? { think: true } : {}),
      messages,
    });
    onStream(stream);

    let output = "";
    for await (const response of stream) {
      if (response.message.thinking) {
        onThinkChunk(response.message.thinking);
      }
      if (response.message.content) {
        output += response.message.content;
        onChunk(response.message.content);
      }
    }
    return output;
  }

  async function streamWithFallback(messages: Message[]): Promise<string> {
    try {
      return await streamOnce(messages, true);
    } catch (err: unknown) {
      const isThinkingError =
        err instanceof Error &&
        (err.message.includes("400") ||
          err.message.toLowerCase().includes("think"));
      if (isThinkingError) {
        return await streamOnce(messages, false);
      }
      throw err;
    }
  }

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    // Re-resolve the full pipeline on every turn so file contents,
    // sub-pipeline outputs, etc. are always up to date.
    const baseMessages = turn === 0
      ? [...options.messages]
      : await resolveMessages();

    const messages = [...baseMessages, ...toolExchange];

    const output = await streamWithFallback(messages);
    finalOutput = output;

    const toolCalls = parseToolCalls(output);
    if (toolCalls.length === 0) break;

    // Record the assistant turn (with its tool call markup)
    toolExchange.push({ role: "assistant", content: output });

    // Execute all tool calls and collect results
    const resultLines: string[] = [];
    for (const call of toolCalls) {
      const argDisplay = call.arg ? `: ${call.arg}` : "";
      onToolStatus(`[${call.name}${argDisplay}]`);
      const result = await executeTool(call, toolbeltCtx);
      resultLines.push(`<tool_result tool="${call.name}">${result}</tool_result>`);
    }

    // Append tool results as a new user message for the next turn
    toolExchange.push({
      role: "user",
      content: resultLines.join("\n"),
    });
  }

  return finalOutput;
}
