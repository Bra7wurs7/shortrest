import { Accessor, createEffect, createSignal, Setter } from "solid-js";
import { LLMModelInfo, LLMProvider, LLMProviderType, detectProvider } from "../types/llmProvider.interface";
import { createOllamaProvider } from "../providers/ollamaProvider";
import { createMistralProvider } from "../providers/mistralProvider";
import { localStorageLLMApiKey, localStorageOllamaUrl } from "../constants/storageKeys";

export interface UseLLMConnectionReturn {
  llmProvider: Accessor<LLMProvider | null>;
  llmProviderType: Accessor<LLMProviderType>;
  llmUrl: Accessor<string>;
  setLLMUrl: Setter<string>;
  llmApiKey: Accessor<string>;
  setLLMApiKey: Setter<string>;
  llmModels: Accessor<LLMModelInfo[] | null>;
  setLLMModels: Setter<LLMModelInfo[] | null>;
}

export function useLLMConnection(): UseLLMConnectionReturn {
  const [llmUrl, setLLMUrl] = createSignal<string>(
    localStorage.getItem(localStorageOllamaUrl) || "127.0.0.1:11434",
  );
  const [llmApiKey, setLLMApiKey] = createSignal<string>(
    localStorage.getItem(localStorageLLMApiKey) || "",
  );
  const [llmModels, setLLMModels] = createSignal<LLMModelInfo[] | null>(null);
  const [llmProvider, setLLMProvider] = createSignal<LLMProvider | null>(null);

  const llmProviderType = (): LLMProviderType => detectProvider(llmUrl());

  // Rebuild provider when URL or API key changes
  createEffect(() => {
    const url = llmUrl();
    const apiKey = llmApiKey();
    const type = detectProvider(url);

    if (type === "mistral") {
      setLLMProvider(createMistralProvider(url, apiKey));
    } else {
      setLLMProvider(createOllamaProvider(url));
    }
  });

  // Re-fetch model list when provider changes
  createEffect(() => {
    const provider = llmProvider();
    if (!provider) return;

    provider
      .listModels()
      .then((models) => {
        setLLMModels(models);
      })
      .catch((err) => {
        console.error("Failed to list models:", err);
        setLLMModels(null);
      });
  });

  // Persist URL
  createEffect(() => {
    localStorage.setItem(localStorageOllamaUrl, llmUrl());
  });

  // Persist API key
  createEffect(() => {
    localStorage.setItem(localStorageLLMApiKey, llmApiKey());
  });

  return {
    llmProvider,
    llmProviderType,
    llmUrl,
    setLLMUrl,
    llmApiKey,
    setLLMApiKey,
    llmModels,
    setLLMModels,
  };
}
