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
  setClipboard: Setter<ClipboardEntry[]>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
  setPromptLoading: Setter<boolean>;
  setModelThoughts: Setter<string>;
  existingThoughts: string;
  /** Optional callback invoked when streaming completes successfully */
  onStreamComplete?: () => void;
}

/**
 * Sends a chat request to Ollama and streams the response to a ClipboardEntry.
 * Supports native thinking models - thoughts are streamed to setModelThoughts.
 * Falls back gracefully for non-thinking models.
 */
export async function streamToFile(
  options: StreamToFileOptions,
): Promise<void> {
  const {
    ollama,
    model,
    messages,
    targetEntry,
    clipboard,
    setClipboard,
    setRunningPrompt,
    setPromptLoading,
    setModelThoughts,
    existingThoughts,
    onStreamComplete,
  } = options;

  // If we have existing thoughts, don't request new ones
  const shouldThink = !existingThoughts;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    think: shouldThink,
    messages,
  };

  try {
    setPromptLoading(true);
    const responseStream = await ollama.chat(request);
    setPromptLoading(false);
    setRunningPrompt(responseStream);

    // Track if we've received any thinking content
    let hasReceivedThinking = false;

    for await (const response of responseStream) {
      // Handle thinking content (native thinking models)
      if (response.message.thinking) {
        if (!hasReceivedThinking) {
          // Clear previous thoughts when new thinking starts
          setModelThoughts("");
          hasReceivedThinking = true;
        }
        setModelThoughts((prev) => prev + response.message.thinking);
      }

      // Handle regular content
      if (response.message.content) {
        targetEntry.setContent((prev) => prev + response.message.content);
      }

      if (response.done) {
        // Ensure the entry is still in the clipboard (user may have saved/discarded it during streaming)
        if (!clipboard().includes(targetEntry)) {
          setClipboard([...clipboard(), targetEntry]);
        }
        storeClipboard(clipboard);
        setRunningPrompt(null);
        onStreamComplete?.();
      }
    }
  } catch (error: unknown) {
    // Check if this is a 400 error related to thinking not being supported
    const isThinkingError =
      error instanceof Error &&
      (error.message.includes("400") ||
        error.message.toLowerCase().includes("think"));

    if (isThinkingError && shouldThink) {
      // Retry without thinking for non-thinking models
      console.log(
        "Model does not support native thinking, retrying without think parameter",
      );
      return streamToFileWithoutThinking(options);
    }

    setPromptLoading(false);
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}

/**
 * Fallback function for models that don't support native thinking.
 * Streams directly to file without the think parameter.
 */
async function streamToFileWithoutThinking(
  options: StreamToFileOptions,
): Promise<void> {
  const {
    ollama,
    model,
    messages,
    targetEntry,
    clipboard,
    setClipboard,
    setRunningPrompt,
    setPromptLoading,
    onStreamComplete,
  } = options;

  const request: ChatRequest & { stream: true } = {
    model,
    stream: true,
    messages,
  };

  try {
    setPromptLoading(true);
    const responseStream = await ollama.chat(request);
    setPromptLoading(false);
    setRunningPrompt(responseStream);

    for await (const response of responseStream) {
      targetEntry.setContent((prev) => prev + response.message.content);

      if (response.done) {
        // Ensure the entry is still in the clipboard (user may have saved/discarded it during streaming)
        if (!clipboard().includes(targetEntry)) {
          setClipboard([...clipboard(), targetEntry]);
        }
        storeClipboard(clipboard);
        setRunningPrompt(null);
        onStreamComplete?.();
      }
    }
  } catch (error) {
    setPromptLoading(false);
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}
