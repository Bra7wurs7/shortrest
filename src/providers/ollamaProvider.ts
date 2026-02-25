import { Ollama } from "ollama";
import {
  LLMAbortableStream,
  LLMFinalChunk,
  LLMModelInfo,
  LLMProvider,
  LLMStreamChunk,
  NativeTool,
  NativeToolCall,
} from "../types/llmProvider.interface";

export function createOllamaProvider(host: string): LLMProvider {
  const ollama = new Ollama({ host });

  return {
    async chat({ model, messages, think, tools }) {
      const stream = await ollama.chat({
        model,
        stream: true as const,
        ...(think ? { think: true } : {}),
        ...(tools ? { tools: tools as Parameters<typeof ollama.chat>[0]["tools"] } : {}),
        messages,
      });

      // Collect tool_calls from the final (done=true) message
      let finalChunk: LLMFinalChunk = {};
      let finalResolve!: (v: LLMFinalChunk) => void;
      const finalPromise = new Promise<LLMFinalChunk>((res) => { finalResolve = res; });

      const abortableStream: LLMAbortableStream = {
        [Symbol.asyncIterator](): AsyncIterator<LLMStreamChunk> {
          const inner = stream[Symbol.asyncIterator]();
          return {
            async next() {
              const result = await inner.next();
              if (result.done) {
                finalResolve(finalChunk);
                return { value: undefined as unknown as LLMStreamChunk, done: true };
              }
              const msg = result.value.message;

              // Ollama emits tool_calls on the final assembled message (done=true on the stream),
              // but some builds emit them on the last streaming chunk before done.
              // Capture tool_calls whenever they appear.
              if (msg.tool_calls && msg.tool_calls.length > 0) {
                const calls: NativeToolCall[] = msg.tool_calls.map((tc) => ({
                  name: tc.function.name,
                  args: tc.function.arguments as Record<string, unknown>,
                }));
                finalChunk = { toolCalls: calls };
              }

              const chunk: LLMStreamChunk = {
                content: msg.content || undefined,
                thinking: (msg as { thinking?: string }).thinking || undefined,
              };
              return { value: chunk, done: false };
            },
          };
        },
        abort() {
          stream.abort();
          finalResolve({});
        },
        final() {
          return finalPromise;
        },
      };

      return abortableStream;
    },

    async listModels() {
      const result = await ollama.list();
      return result.models.map((m): LLMModelInfo => ({
        id: m.model,
        name: m.name,
      }));
    },
  };
}
