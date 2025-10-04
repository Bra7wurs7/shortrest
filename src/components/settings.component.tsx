import { Accessor, For, JSXElement, Setter } from "solid-js";
import { localStorageAppMode } from "../App";
import { AppMode } from "../types/appMode.enum";
import { ModelResponse, Ollama } from "ollama";

export function SettingsComponent(
  ollamaConnection: Accessor<Ollama | null>,
  setOllamaConnection: Setter<Ollama | null>,
  ollamaModel: Accessor<ModelResponse | null>,
  setOllamaModel: Setter<ModelResponse | null>,
  ollamaModels: Accessor<ModelResponse[] | null>,
  setOllamaModels: Setter<ModelResponse[] | null>,
  ollamaUrl: Accessor<string>,
  setOllamaUrl: Setter<string>,
): JSXElement {
  return (
    <div id="SETTINGS_WINDOW">
      <div id="SETTINGS_HEADER"></div>
      <div class="settings_category">
        <div class="category_title">
          <div class="left">
            <i class="bx bx-bot"></i>
            <div class="category_title_name">ollama</div>
          </div>
          <div class="right">
            <input
              value={ollamaUrl()}
              onchange={(e) => {
                setOllamaUrl(e.currentTarget.value);
              }}
            ></input>
            <select
              class="action_options"
              onchange={(e) => {
                setOllamaModel(
                  ollamaModels()?.find(
                    (m) => m.model === e.currentTarget.value,
                  ) ?? null,
                );
              }}
            >
              <For each={ollamaModels()}>
                {(model: ModelResponse) => (
                  <option
                    selected={ollamaModel() === model}
                    onselect={() => {
                      setOllamaModel(model);
                    }}
                  >
                    {model.name}
                  </option>
                )}
              </For>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
