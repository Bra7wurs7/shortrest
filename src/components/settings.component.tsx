import { Accessor, JSXElement, Setter } from "solid-js";
import { Ollama } from "ollama";
import { ModelResponse } from "ollama";

export function SettingsComponent(
  ollamaConnection: Accessor<Ollama | null>,
  setOllamaConnection: Setter<Ollama | null>,
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
      </div>
    </div>
  );
}
