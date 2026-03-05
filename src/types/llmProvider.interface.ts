export interface LLMModelInfo {
  id: string;
  name: string;
}

/** A single parameter property in a tool's JSON Schema */
export interface NativeToolProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  /** For array types: describes the element type */
  items?: NativeToolProperty;
}

/** Native tool definition passed to the LLM API */
export interface NativeTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, NativeToolProperty>;
      required?: string[];
    };
  };
}

/** A tool call returned by the model in the final assembled response */
export interface NativeToolCall {
  name: string;
  /** Parsed arguments object */
  args: Record<string, unknown>;
}

export interface LLMStreamChunk {
  content?: string;
  thinking?: string;
}

/** Final chunk may carry tool calls assembled from the full response */
export interface LLMFinalChunk {
  toolCalls?: NativeToolCall[];
}

export type LLMAbortableStream = AsyncIterable<LLMStreamChunk> & {
  abort(): void;
  /** Resolved after the stream completes — carries any tool calls from the response */
  final(): Promise<LLMFinalChunk>;
};

export interface LLMProvider {
  chat(params: {
    model: string;
    messages: { role: string; content: string }[];
    stream: true;
    think?: boolean;
    tools?: NativeTool[];
  }): Promise<LLMAbortableStream>;

  listModels(): Promise<LLMModelInfo[]>;
}

export type LLMProviderType = "ollama" | "mistral";

export function detectProvider(url: string): LLMProviderType {
  const lower = url.toLowerCase();
  if (lower.includes("mistral")) return "mistral";
  return "ollama";
}
