import { LLMAbortableStream, LLMMessage, LLMModelInfo, LLMProvider, ThinkingEffort } from "../../types/llmProvider.interface";

export interface RunSubPipelineOptions {
  provider: LLMProvider;
  model: LLMModelInfo;
  messages: LLMMessage[];
  /** Called immediately after the stream is opened, before any tokens are consumed. */
  onStream?: (stream: LLMAbortableStream) => void;
  /** Called with each content chunk as it arrives, enabling incremental display. */
  onChunk?: (text: string) => void;
  /** Thinking-effort budget (null = thinking off). */
  thinkEffort?: ThinkingEffort | null;
  /** Context window size in tokens (null = server default). */
  contextSize?: number | null;
}

/**
 * Executes a sub-pipeline by sending messages to the LLM provider and streaming the
 * response. The complete output is returned as a string; if onChunk is provided, each
 * content token is also emitted incrementally for live display.
 * Thinking tokens are discarded; only content is returned.
 * Falls back to non-thinking mode if the model does not support it.
 * The onStream callback receives the live stream so the caller can abort it.
 */
export async function runSubPipeline(
  options: RunSubPipelineOptions,
): Promise<string> {
  const { provider, model, messages, onStream, onChunk, thinkEffort, contextSize } = options;

  async function attemptRun(think: ThinkingEffort | false | undefined): Promise<string> {
    const stream = await provider.chat({
      model: model.id,
      stream: true as const,
      ...(think !== undefined ? { think } : {}),
      ...(contextSize ? { contextSize } : {}),
      messages,
    });

    // Notify caller of the new stream so the abort handle is always current,
    // including when this is a retry after a think-unsupported error.
    onStream?.(stream);

    let output = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        output += chunk.content;
        onChunk?.(chunk.content);
      }
    }
    return output;
  }

  try {
    // Off (null) -> explicit think: false so thinking models stop thinking.
    return await attemptRun(thinkEffort ?? false);
  } catch (error: unknown) {
    const isThinkingError =
      error instanceof Error &&
      (error.message.includes("400") ||
        error.message.toLowerCase().includes("think"));
    if (isThinkingError) {
      // Model rejects the think param entirely: retry with it omitted.
      return await attemptRun(undefined);
    }
    throw error;
  }
}
