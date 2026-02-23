import { Accessor, createEffect, createSignal, Setter } from "solid-js";
import { ModelResponse, Ollama } from "ollama";
import { localStorageOllamaUrl } from "../constants/storageKeys";

export interface UseOllamaConnectionReturn {
  ollamaConnection: Accessor<Ollama | null>;
  setOllamaConnection: Setter<Ollama | null>;
  ollamaUrl: Accessor<string>;
  setOllamaUrl: Setter<string>;
  ollamaModels: Accessor<ModelResponse[] | null>;
  setOllamaModels: Setter<ModelResponse[] | null>;
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

  createEffect(() => {
    setOllamaConnection(new Ollama({ host: ollamaUrl() }));
  });

  createEffect(() => {
    ollamaConnection()
      ?.list()
      .then((m) => {
        setOllamaModels(m.models);
      })
      .catch((err) => {
        console.error("Failed to list Ollama models:", err);
        setOllamaModels(null);
      });
  });

  createEffect(() => {
    localStorage.setItem(localStorageOllamaUrl, ollamaUrl());
  });

  return {
    ollamaConnection,
    setOllamaConnection,
    ollamaUrl,
    setOllamaUrl,
    ollamaModels,
    setOllamaModels,
  };
}
