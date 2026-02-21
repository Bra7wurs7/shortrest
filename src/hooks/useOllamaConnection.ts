import { Accessor, createEffect, createSignal, Setter, untrack } from "solid-js";
import { ModelResponse, Ollama } from "ollama";
import {
  localStorageOllamaSummaryModel,
  localStorageOllamaUrl,
} from "../constants/storageKeys";

export interface UseOllamaConnectionReturn {
  ollamaConnection: Accessor<Ollama | null>;
  setOllamaConnection: Setter<Ollama | null>;
  ollamaUrl: Accessor<string>;
  setOllamaUrl: Setter<string>;
  ollamaModels: Accessor<ModelResponse[] | null>;
  setOllamaModels: Setter<ModelResponse[] | null>;
  ollamaSummaryModel: Accessor<ModelResponse | null>;
  setOllamaSummaryModel: Setter<ModelResponse | null>;
}

export function useOllamaConnection(): UseOllamaConnectionReturn {
  const [ollamaConnection, setOllamaConnection] = createSignal<Ollama | null>(
    new Ollama(),
  );
  const [ollamaUrl, setOllamaUrl] = createSignal<string>(
    localStorage.getItem(localStorageOllamaUrl) || "127.0.0.1:11434",
  );
  const [ollamaModels, setOllamaModels] = createSignal<ModelResponse[] | null>(
    null,
  );
  const [ollamaSummaryModel, setOllamaSummaryModel] =
    createSignal<ModelResponse | null>(null);

  createEffect(() => {
    setOllamaConnection(new Ollama({ host: ollamaUrl() }));
  });

  createEffect(() => {
    ollamaConnection()
      ?.list()
      .then((m) => {
        setOllamaModels(m.models);
      })
      .catch(() => {
        setOllamaModels(null);
      });
  });

  createEffect(() => {
    localStorage.setItem(localStorageOllamaUrl, ollamaUrl());
  });

  createEffect(() => {
    const llmModel = ollamaSummaryModel();
    if (llmModel !== null) {
      localStorage.setItem(localStorageOllamaSummaryModel, llmModel.model);
    }
  });

  createEffect(() => {
    const llmModel = untrack(ollamaSummaryModel);
    const allLlmModels = ollamaModels();
    if (allLlmModels && allLlmModels.length > 0 && llmModel === null) {
      const localStorageModelName = localStorage.getItem(
        localStorageOllamaSummaryModel,
      );
      const model = allLlmModels.find((m) => m.model === localStorageModelName);
      if (model !== undefined) {
        setOllamaSummaryModel(model);
      } else {
        setOllamaSummaryModel(allLlmModels[0] ?? null);
      }
    }
  });

  return {
    ollamaConnection,
    setOllamaConnection,
    ollamaUrl,
    setOllamaUrl,
    ollamaModels,
    setOllamaModels,
    ollamaSummaryModel,
    setOllamaSummaryModel,
  };
}
