import { ChatRequest, Message, Ollama } from "ollama";
import { Accessor, Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";
import { ReactiveFile } from "../../types/reactiveFile.interface";
import { storeOpenFiles } from "../../storage";

export interface StreamToFileOptions {
  ollama: Ollama;
  model: string;
  messages: Message[];
  targetFile: ReactiveFile;
  openFiles: Accessor<ReactiveFile[]>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
}

/**
 * Sends a chat request to Ollama and streams the response to a ReactiveFile.
 * Appends the streamed content to the file's existing content.
 */
export async function streamToFile(
  options: StreamToFileOptions,
): Promise<void> {
  const { ollama, model, messages, targetFile, openFiles, setRunningPrompt } =
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
      targetFile.setContent((prev) => prev + response.message.content);

      if (response.done) {
        storeOpenFiles(openFiles);
        setRunningPrompt(null);
      }
    }
  } catch (error) {
    setRunningPrompt(null);
    console.error("Error processing chat response:", error);
    throw error;
  }
}
