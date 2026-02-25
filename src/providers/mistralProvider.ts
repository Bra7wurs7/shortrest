import { Mistral } from "@mistralai/mistralai";
import { LLMAbortableStream, LLMModelInfo, LLMProvider, LLMStreamChunk } from "../types/llmProvider.interface";

export function createMistralProvider(serverURL: string, apiKey: string): LLMProvider {
  const client = new Mistral({ apiKey, serverURL });

  return {
    async chat({ model, messages, }) {
      const eventStream = await client.chat.stream({
        model,
        messages: messages as Parameters<typeof client.chat.stream>[0]["messages"],
      });

      let aborted = false;

      const abortableStream: LLMAbortableStream = {
        [Symbol.asyncIterator](): AsyncIterator<LLMStreamChunk> {
          const inner = eventStream[Symbol.asyncIterator]();
          return {
            async next() {
              if (aborted) return { value: undefined as unknown as LLMStreamChunk, done: true };
              const result = await inner.next();
              if (result.done) return { value: undefined as unknown as LLMStreamChunk, done: true };
              const delta = result.value.data?.choices?.[0]?.delta;
              const content = typeof delta?.content === "string" ? delta.content : undefined;
              const chunk: LLMStreamChunk = { content };
              return { value: chunk, done: false };
            },
          };
        },
        abort() {
          aborted = true;
        },
      };

      return abortableStream;
    },

    async listModels(): Promise<LLMModelInfo[]> {
      const result = await client.models.list();
      const data = result.data ?? [];
      return data
        .map((m): LLMModelInfo => ({
          id: m.id,
          name: (m as { name?: string | null }).name || m.id,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    },
  };
}
