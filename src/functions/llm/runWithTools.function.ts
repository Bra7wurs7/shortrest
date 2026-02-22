import { AbortableAsyncIterator, ChatResponse, Message, Ollama, ModelResponse } from "ollama";
import { parseToolCalls, executeTool, ToolbeltContext } from "./toolbeltExecutor.function";

const MAX_TOOL_TURNS = 10;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  /** Called with each streamed content chunk during the final (no-tool-calls) turn */
  onChunk: (text: string) => void;
  /** Called with each thinking chunk */
  onThinkChunk: (text: string) => void;
  /**
   * Called after each tool-call turn with the fully-resolved output for that turn,
   * including inline tool call markup and results — ready for display.
   */
  onToolTurnComplete: (formattedTurn: string) => void;
  /** Called with the clipboard accessor so tool context always reads current state */
  getClipboard: () => ToolbeltContext["clipboard"];
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
  const { ollama, model, toolbeltCtx, resolveMessages, onStream, onChunk, onThinkChunk, onToolTurnComplete, getClipboard } = options;

  // toolExchange accumulates the assistant+tool-result pairs from this agentic session.
  // On each follow-up turn, fresh base messages are resolved and this exchange is appended.
  const toolExchange: Message[] = [];

  let finalOutput = "";
  let emittedFinal = false;

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

    if (toolCalls.length === 0) {
      // Final turn: no tool calls, emit directly to live display
      onChunk(output);
      emittedFinal = true;
      break;
    }

    // Execute all tool calls with a fresh clipboard snapshot so writes from
    // earlier turns are visible to subsequent reads within the same session.
    const ctx: ToolbeltContext = {
      ...toolbeltCtx,
      clipboard: getClipboard(),
    };

    const resultLines: string[] = [];
    for (const call of toolCalls) {
      const result = await executeTool(call, ctx);
      resultLines.push(`<tool_result tool="${call.name}">${result}</tool_result>`);
    }

    // Build an annotated copy of the output: inline each result right after its call tag.
    // We process the string once left-to-right, consuming calls in order, so duplicate
    // tool names are matched positionally rather than all replacing the first occurrence.
    let annotatedOutput = output;
    let searchFrom = 0;
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      // Match the specific call tag (with optional arg) starting from where we left off
      const tagPattern = new RegExp(
        `<tool>${escapeRegExp(call.name)}<\\/tool>(?:<arg>[\\s\\S]*?<\\/arg>)?`,
      );
      const relative = annotatedOutput.slice(searchFrom).search(tagPattern);
      if (relative === -1) continue;
      const matchStart = searchFrom + relative;
      const tagMatch = tagPattern.exec(annotatedOutput.slice(matchStart));
      if (!tagMatch) continue;
      const matchEnd = matchStart + tagMatch[0].length;
      const insertion = tagMatch[0] + resultLines[i];
      annotatedOutput = annotatedOutput.slice(0, matchStart) + insertion + annotatedOutput.slice(matchEnd);
      searchFrom = matchStart + insertion.length;
    }

    // Emit the annotated turn (call + inline result) to the display
    onToolTurnComplete(annotatedOutput);

    // Record for the next Ollama turn
    toolExchange.push({ role: "assistant", content: output });
    toolExchange.push({ role: "user", content: resultLines.join("\n") });
  }

  // If all turns contained tool calls and the loop exhausted MAX_TOOL_TURNS,
  // onChunk was never called — emit whatever we have so the display isn't empty.
  if (!emittedFinal && finalOutput) {
    onChunk(finalOutput);
  }

  return finalOutput;
}
