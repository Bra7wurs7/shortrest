import { ChatRequest, Message, Ollama } from "ollama";
import { Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";

export interface StreamContentToSignalOptions {
  ollama: Ollama;
  model: string;
  messages: Message[];
  setTargetSignal: Setter<string>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
}

/**
 * Sends a chat request to Ollama and streams the content response to a signal.
 * Unlike streamToSignal, this captures the actual content output, not thinking.
 * Thinking is enabled to improve output quality, but thinking tokens are discarded.
 * Falls back gracefully for models that don't support thinking.
 */
export async function streamContentToSignal(
  options: StreamContentToSignalOptions,
): Promise<void> {
  const { ollama, model, messages, setTargetSignal, setRunningPrompt } =
    options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    think: true,
    messages,
  };

  try {
    const responseStream = await ollama.chat(request);
    setRunningPrompt(responseStream);

    setTargetSignal(""); // Clear before streaming

    for await (const response of responseStream) {
      // Only capture content, ignore thinking
      if (response.message.content) {
        setTargetSignal((prev) => prev + response.message.content);
      }

      if (response.done) {
        setRunningPrompt(null);
      }
    }
  } catch (error: unknown) {
    // Check if this is a 400 error related to thinking not being supported
    const isThinkingError =
      error instanceof Error &&
      (error.message.includes("400") ||
        error.message.toLowerCase().includes("think"));

    if (isThinkingError) {
      // Retry without thinking for non-thinking models
      console.log(
        "Model does not support thinking, retrying without think parameter",
      );
      return streamContentToSignalWithoutThinking(options);
    }

    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}

/**
 * Fallback function for models that don't support thinking.
 * Streams content directly without the think parameter.
 */
async function streamContentToSignalWithoutThinking(
  options: StreamContentToSignalOptions,
): Promise<void> {
  const { ollama, model, messages, setTargetSignal, setRunningPrompt } =
    options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    messages,
  };

  try {
    const responseStream = await ollama.chat(request);
    setRunningPrompt(responseStream);

    setTargetSignal(""); // Clear before streaming

    for await (const response of responseStream) {
      if (response.message.content) {
        setTargetSignal((prev) => prev + response.message.content);
      }

      if (response.done) {
        setRunningPrompt(null);
      }
    }
  } catch (error) {
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}
