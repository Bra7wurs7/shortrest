import {
  Accessor,
  createEffect,
  createSignal,
  For,
  JSXElement,
  Setter,
  Show,
} from "solid-js";
import { ModelResponse, Ollama, ShowResponse } from "ollama";

interface ModelEntryProps {
  title: string;
  description: string;
  icon: string;
  ollamaConnection: Accessor<Ollama | null>;
  ollamaModels: Accessor<ModelResponse[] | null>;
  selectedModel: Accessor<ModelResponse | null>;
  setSelectedModel: Setter<ModelResponse | null>;
}

function ModelEntry(props: ModelEntryProps): JSXElement {
  const [capabilities, setCapabilities] = createSignal<string[]>([]);

  // Fetch capabilities when selected model changes
  createEffect(() => {
    const model = props.selectedModel();
    const ollama = props.ollamaConnection();
    if (model && ollama) {
      ollama
        .show({ model: model.model })
        .then((response: ShowResponse) => {
          setCapabilities(response.capabilities ?? []);
        })
        .catch(() => {
          setCapabilities([]);
        });
    } else {
      setCapabilities([]);
    }
  });

  const hasCapability = (cap: string) => capabilities().includes(cap);

  return (
    <div class="settings_entry">
      <div class="entry_header">
        <i class={`bx ${props.icon}`}></i>
        <div class="entry_title">{props.title}</div>
        <div class="entry_description">{props.description}</div>
      </div>
      <div class="entry_controls">
        <select
          onchange={(e) => {
            props.setSelectedModel(
              props
                .ollamaModels()
                ?.find((m) => m.model === e.currentTarget.value) ?? null,
            );
          }}
        >
          <For each={props.ollamaModels()}>
            {(model: ModelResponse) => (
              <option
                value={model.model}
                selected={props.selectedModel()?.model === model.model}
              >
                {model.name}
              </option>
            )}
          </For>
        </select>
      </div>
      <Show when={props.selectedModel()}>
        <div class="entry_capabilities">
          <div
            class={`capability ${hasCapability("thinking") ? "supported" : "unsupported"}`}
          >
            <i class="bx bx-brain"></i>
            <span>Thinking</span>
          </div>
          <div
            class={`capability ${hasCapability("vision") ? "supported" : "unsupported"}`}
          >
            <i class="bx bx-image"></i>
            <span>Vision</span>
          </div>
          <div
            class={`capability ${hasCapability("tools") ? "supported" : "unsupported"}`}
          >
            <i class="bx bx-wrench"></i>
            <span>Tools</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

export function SettingsComponent(
  ollamaConnection: Accessor<Ollama | null>,
  setOllamaConnection: Setter<Ollama | null>,
  ollamaModel: Accessor<ModelResponse | null>,
  setOllamaModel: Setter<ModelResponse | null>,
  ollamaSummaryModel: Accessor<ModelResponse | null>,
  setOllamaSummaryModel: Setter<ModelResponse | null>,
  ollamaModels: Accessor<ModelResponse[] | null>,
  setOllamaModels: Setter<ModelResponse[] | null>,
  ollamaUrl: Accessor<string>,
  setOllamaUrl: Setter<string>,
): JSXElement {
  return (
    <div id="SETTINGS_WINDOW">
      <div class="settings_group">
        <div class="settings_entry group_header">
          <div class="entry_header">
            <i class="bx bx-server"></i>
            <div class="entry_title">Ollama Connection</div>
            <div class="entry_description">Server URL for Ollama API</div>
          </div>
          <div class="entry_controls">
            <input
              value={ollamaUrl()}
              onchange={(e) => {
                setOllamaUrl(e.currentTarget.value);
              }}
              placeholder="Ollama URL"
            />
          </div>
        </div>
        <div class="group_children">
          <ModelEntry
            title="Primary Model"
            description="General purpose LLM for writing and chat"
            icon="bx-bot"
            ollamaConnection={ollamaConnection}
            ollamaModels={ollamaModels}
            selectedModel={ollamaModel}
            setSelectedModel={setOllamaModel}
          />
          <ModelEntry
            title="Summary Model"
            description="Smaller model for rolling summaries"
            icon="bx-file"
            ollamaConnection={ollamaConnection}
            ollamaModels={ollamaModels}
            selectedModel={ollamaSummaryModel}
            setSelectedModel={setOllamaSummaryModel}
          />
        </div>
      </div>
    </div>
  );
}
