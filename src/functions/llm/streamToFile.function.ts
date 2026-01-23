import { ChatRequest, Message, Ollama } from "ollama";
import { Accessor, Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import { storeClipboard } from "../storage.functions";

export interface StreamToFileOptions {
  ollama: Ollama;
  model: string;
  messages: Message[];
  targetEntry: ClipboardEntry;
  clipboard: Accessor<ClipboardEntry[]>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
}

/**
 * Sends a chat request to Ollama and streams the response to a ClipboardEntry.
 * Appends the streamed content to the entry's existing content.
 */
export async function streamToFile(
  options: StreamToFileOptions,
): Promise<void> {
  const { ollama, model, messages, targetEntry, clipboard, setRunningPrompt } =
    options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    think: false,
    messages,
  };

  try {
    const responseStream = await ollama.chat(request);
    setRunningPrompt(responseStream);

    for await (const response of responseStream) {
      targetEntry.setContent((prev) => prev + response.message.content);

      if (response.done) {
        storeClipboard(clipboard);
        setRunningPrompt(null);
      }
    }
  } catch (error) {
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}
