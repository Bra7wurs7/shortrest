import { Ollama } from "ollama";
import { LLMAbortableStream, LLMModelInfo, LLMProvider, LLMStreamChunk } from "../types/llmProvider.interface";

export function createOllamaProvider(host: string): LLMProvider {
  const ollama = new Ollama({ host });

  return {
    async chat({ model, messages, think }) {
      const stream = await ollama.chat({
        model,
        stream: true as const,
        ...(think ? { think: true } : {}),
        messages,
      });

      const abortableStream: LLMAbortableStream = {
        [Symbol.asyncIterator](): AsyncIterator<LLMStreamChunk> {
          const inner = stream[Symbol.asyncIterator]();
          return {
            async next() {
              const result = await inner.next();
              if (result.done) return { value: undefined as unknown as LLMStreamChunk, done: true };
              const chunk: LLMStreamChunk = {
                content: result.value.message.content || undefined,
                thinking: (result.value.message as { thinking?: string }).thinking || undefined,
              };
              return { value: chunk, done: false };
            },
          };
        },
        abort() {
          stream.abort();
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
