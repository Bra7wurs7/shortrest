import { Mistral } from "@mistralai/mistralai";
import {
  LLMAbortableStream,
  LLMFinalChunk,
  LLMModelInfo,
  LLMProvider,
  LLMStreamChunk,
  NativeTool,
  NativeToolCall,
} from "../types/llmProvider.interface";

export function createMistralProvider(serverURL: string, apiKey: string): LLMProvider {
  const client = new Mistral({ apiKey, serverURL });

  return {
    async chat({ model, messages, tools }) {
      const eventStream = await client.chat.stream({
        model,
        messages: messages as Parameters<typeof client.chat.stream>[0]["messages"],
        ...(tools ? { tools: tools as Parameters<typeof client.chat.stream>[0]["tools"] } : {}),
      });

      let aborted = false;
      let finalChunk: LLMFinalChunk = {};
      let finalResolve!: (v: LLMFinalChunk) => void;
      const finalPromise = new Promise<LLMFinalChunk>((res) => { finalResolve = res; });

      const abortableStream: LLMAbortableStream = {
        [Symbol.asyncIterator](): AsyncIterator<LLMStreamChunk> {
          const inner = eventStream[Symbol.asyncIterator]();
          return {
            async next() {
              if (aborted) {
                finalResolve(finalChunk);
                return { value: undefined as unknown as LLMStreamChunk, done: true };
              }
              const result = await inner.next();
              if (result.done) {
                finalResolve(finalChunk);
                return { value: undefined as unknown as LLMStreamChunk, done: true };
              }
              const choice = result.value.data?.choices?.[0];
              const delta = choice?.delta;

              // Capture tool_calls when the model returns them instead of text
              if (delta?.tool_calls && delta.tool_calls.length > 0) {
                const calls: NativeToolCall[] = delta.tool_calls
                  .filter((tc) => tc.function?.name)
                  .map((tc) => {
                    let args: Record<string, unknown> = {};
                    try {
                      args = JSON.parse(tc.function?.arguments ?? "{}");
                    } catch {
                      // ignore malformed JSON
                    }
                    return { name: tc.function!.name!, args };
                  });
                if (calls.length > 0) {
                  finalChunk = { toolCalls: calls };
                }
              }

              const content = typeof delta?.content === "string" ? delta.content : undefined;
              const chunk: LLMStreamChunk = { content };
              return { value: chunk, done: false };
            },
          };
        },
        abort() {
          aborted = true;
          finalResolve({});
        },
        final() {
          return finalPromise;
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
