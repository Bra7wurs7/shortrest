import { LLMAbortableStream, LLMMessage, LLMModelInfo, LLMProvider } from "../../types/llmProvider.interface";

export interface RunSubPipelineOptions {
  provider: LLMProvider;
  model: LLMModelInfo;
  messages: LLMMessage[];
  /** Called immediately after the stream is opened, before any tokens are consumed. */
  onStream?: (stream: LLMAbortableStream) => void;
}

/**
 * Executes a sub-pipeline by sending messages to the LLM provider and accumulating the
 * full response. Non-streaming — the complete output is returned as a string.
 * Thinking tokens are discarded; only content is returned.
 * Falls back to non-thinking mode if the model does not support it.
 * The onStream callback receives the live stream so the caller can abort it.
 */
export async function runSubPipeline(
  options: RunSubPipelineOptions,
): Promise<string> {
  const { provider, model, messages, onStream } = options;

  async function attemptRun(withThink: boolean): Promise<string> {
    const stream = await provider.chat({
      model: model.id,
      stream: true as const,
      ...(withThink ? { think: true } : {}),
      messages,
    });

    // Notify caller of the new stream so the abort handle is always current,
    // including when this is a retry after a think-unsupported error.
    onStream?.(stream);

    let output = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        output += chunk.content;
      }
    }
    return output;
  }

  try {
    return await attemptRun(true);
  } catch (error: unknown) {
    const isThinkingError =
      error instanceof Error &&
      (error.message.includes("400") ||
        error.message.toLowerCase().includes("think"));
    if (isThinkingError) {
      return await attemptRun(false);
    }
    throw error;
  }
}
