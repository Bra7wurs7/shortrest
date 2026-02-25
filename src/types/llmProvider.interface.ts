export interface LLMModelInfo {
  id: string;
  name: string;
}

export interface LLMStreamChunk {
  content?: string;
  thinking?: string;
}

export type LLMAbortableStream = AsyncIterable<LLMStreamChunk> & { abort(): void };

export interface LLMProvider {
  chat(params: {
    model: string;
    messages: { role: string; content: string }[];
    stream: true;
    think?: boolean;
  }): Promise<LLMAbortableStream>;

  listModels(): Promise<LLMModelInfo[]>;
}

export type LLMProviderType = "ollama" | "mistral";

export function detectProvider(url: string): LLMProviderType {
  const lower = url.toLowerCase();
  if (lower.includes("mistral")) return "mistral";
  return "ollama";
}
