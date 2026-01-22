import { ChatRequest, Message, Ollama } from "ollama";
import { Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";

export interface StreamToSignalOptions {
  ollama: Ollama;
  model: string;
  messages: Message[];
  setTargetSignal: Setter<string>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
  stopSequence?: string;
}

/**
 * Sends a chat request to Ollama and streams the response to a string signal.
 * Clears the signal before streaming and optionally handles stop sequences.
 */
export async function streamToSignal(
  options: StreamToSignalOptions,
): Promise<void> {
  const {
    ollama,
    model,
    messages,
    setTargetSignal,
    setRunningPrompt,
    stopSequence,
  } = options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    messages,
    options: stopSequence ? { stop: [stopSequence] } : undefined,
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
        // Handle think tag closing if using </think> stop sequence
        if (stopSequence === "</think>" && totalMessage.startsWith("<think>")) {
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
