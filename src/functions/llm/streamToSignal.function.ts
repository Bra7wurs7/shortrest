import { ChatRequest, Message, Ollama } from "ollama";
import { Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";

export interface StreamToSignalOptions {
  ollama: Ollama;
  model: string;
  messages: Message[];
  setTargetSignal: Setter<string>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
}

/**
 * Sends a chat request to Ollama for thinking only.
 * Uses native thinking if supported, falls back to </think> stop sequence.
 * Only captures thinking content, not the final answer.
 */
export async function streamToSignal(
  options: StreamToSignalOptions,
): Promise<void> {
  const { ollama, model, messages, setTargetSignal, setRunningPrompt } =
    options;

  // First, try with native thinking enabled
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
    let hasReceivedThinking = false;
    let thinkingComplete = false;

    for await (const response of responseStream) {
      // Handle native thinking content
      if (response.message.thinking) {
        hasReceivedThinking = true;
        setTargetSignal((prev) => prev + response.message.thinking);
      }

      // For native thinking models, we want to stop after thinking is done
      // The thinking is complete when we start receiving content or when done
      if (
        hasReceivedThinking &&
        response.message.content &&
        !thinkingComplete
      ) {
        thinkingComplete = true;
        // Abort the stream since we only want thinking
        responseStream.abort();
        setRunningPrompt(null);
        return;
      }

      if (response.done) {
        setRunningPrompt(null);
        // If we received thinking content, we're done
        if (hasReceivedThinking) {
          return;
        }
        // If no thinking was received, the model doesn't support native thinking
        // Fall back to stop sequence approach
        break;
      }
    }

    // If we got here without receiving thinking, try fallback
    if (!hasReceivedThinking) {
      console.log(
        "Model did not produce native thinking, trying stop sequence fallback",
      );
      return streamToSignalWithStopSequence(options);
    }
  } catch (error: unknown) {
    // Check if this is a 400 error related to thinking not being supported
    const isThinkingError =
      error instanceof Error &&
      (error.message.includes("400") ||
        error.message.toLowerCase().includes("think"));

    if (isThinkingError) {
      // Retry with stop sequence approach for non-thinking models
      console.log(
        "Model does not support native thinking, using stop sequence fallback",
      );
      return streamToSignalWithStopSequence(options);
    }

    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}

/**
 * Fallback function for models that don't support native thinking.
 * Uses </think> stop sequence to capture thinking content from models
 * that produce <think> tags in their content.
 */
async function streamToSignalWithStopSequence(
  options: StreamToSignalOptions,
): Promise<void> {
  const { ollama, model, messages, setTargetSignal, setRunningPrompt } =
    options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    messages,
    options: { stop: ["</think>"] },
  };

  try {
    const responseStream = await ollama.chat(request);
    setRunningPrompt(responseStream);

    setTargetSignal(""); // Clear before streaming
    let totalMessage = "";

    for await (const response of responseStream) {
      totalMessage += response.message.content;
      setTargetSignal((prev) => prev + response.message.content);

      if (response.done) {
        // Handle think tag closing if content started with <think>
        if (totalMessage.startsWith("<think>")) {
          setTargetSignal((prev) => prev + "</think>");
        }
        setRunningPrompt(null);
      }
    }
  } catch (error) {
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}
