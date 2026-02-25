import {
  Accessor,
  For,
  JSXElement,
  Match,
  Setter,
  Show,
  Switch,
} from "solid-js";
import { LLMAbortableStream, LLMModelInfo, LLMProviderType } from "../types/llmProvider.interface";

const PRESET_URLS = [
  { label: "Local Ollama", url: "127.0.0.1:11434" },
  { label: "Mistral", url: "https://api.mistral.ai" },
];

export interface LlmNodeProps {
  collapsed: Accessor<boolean>;
  setCollapsed: Setter<boolean>;
  llmUrl: Accessor<string>;
  setLLMUrl: Setter<string>;
  llmApiKey: Accessor<string>;
  setLLMApiKey: Setter<string>;
  llmProviderType: Accessor<LLMProviderType>;
  llmModels: Accessor<LLMModelInfo[] | null>;
  llmModel: Accessor<LLMModelInfo | null>;
  setLLMModel: (model: LLMModelInfo | null) => void;
  promptLoading: Accessor<boolean>;
  runningPrompt: Accessor<LLMAbortableStream | null>;
  pendingContinue: Accessor<(() => void) | null>;
  onSubmit: () => void;
}

function providerIcon(type: LLMProviderType): string {
  switch (type) {
    case "mistral": return "bx-wind";
    default: return "bx-server";
  }
}

function providerLabel(type: LLMProviderType): string {
  switch (type) {
    case "mistral": return "Mistral";
    default: return "Ollama";
  }
}

export function LlmNode(props: LlmNodeProps): JSXElement {
  return (
    <div
      class={
        "ai_section pipeline_node ollama_node" +
        (props.collapsed() ? " collapsed" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() => props.setCollapsed(!props.collapsed())}
      >
        <div class="left">
          <i
            class={
              "bx " +
              (props.collapsed() ? "bx-chevron-right" : "bx-chevron-down")
            }
          />
          <i class={"bx " + providerIcon(props.llmProviderType())} />
          <Switch fallback={<span>{providerLabel(props.llmProviderType())}</span>}>
            <Match when={props.promptLoading()}>
              <span class="llm_status_text">waiting…</span>
            </Match>
            <Match when={props.runningPrompt() !== null}>
              <span class="llm_status_text">generating…</span>
            </Match>
            <Match when={props.pendingContinue() !== null}>
              <span class="llm_status_text">paused · re-submit to continue</span>
            </Match>
          </Switch>
        </div>
        <div class="right" onclick={(e) => e.stopPropagation()}>
          <Switch
            fallback={
              <button
                class="node_run_btn"
                title="Run pipeline"
                onClick={props.onSubmit}
              >
                <i class="bx bx-play" />
              </button>
            }
          >
            <Match when={props.promptLoading()}>
              <button class="node_run_btn loading" disabled>
                <i class="bx bx-loader-alt bx-spin" />
              </button>
            </Match>
            <Match when={props.runningPrompt() !== null}>
              <button
                class="node_run_btn abort"
                onClick={() => props.runningPrompt()?.abort()}
                title="Abort"
              >
                <i class="bx bx-stop" />
              </button>
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={!props.collapsed()}>
        <div class="prompt_settings">
          <div class="settings_row preset_buttons">
            <For each={PRESET_URLS}>
              {(preset) => (
                <button
                  class={
                    "preset_url_btn" +
                    (props.llmUrl() === preset.url ? " active" : "")
                  }
                  onClick={() => props.setLLMUrl(preset.url)}
                  title={preset.url}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
          <div class="settings_row">
            <input
              value={props.llmUrl()}
              onchange={(e) => props.setLLMUrl(e.currentTarget.value)}
              placeholder="127.0.0.1:11434"
            />
          </div>
          <Show when={props.llmProviderType() === "mistral"}>
            <div class="settings_row">
              <input
                type="password"
                value={props.llmApiKey()}
                onchange={(e) => props.setLLMApiKey(e.currentTarget.value)}
                placeholder="Mistral API key"
              />
            </div>
          </Show>
        </div>
        <div class="prompt_body">
          <Show
            when={props.llmModels() && props.llmModels()!.length > 0}
            fallback={
              <div class="no_models_message">
                <Show
                  when={props.llmProviderType() === "mistral"}
                  fallback={
                    <>
                      <p>No models found.</p>
                      <p>
                        Browse models at{" "}
                        <a
                          href="https://ollama.com/search"
                          target="_blank"
                          rel="noopener"
                        >
                          ollama.com/search
                        </a>
                      </p>
                      <p>
                        Install a small model:{" "}
                        <code>ollama run mistral:3b</code>
                      </p>
                    </>
                  }
                >
                  <p>No models found.</p>
                  <p>Enter a valid Mistral API key above.</p>
                </Show>
              </div>
            }
          >
            <select
              class="model_select"
              onchange={(e) => {
                const model = props
                  .llmModels()
                  ?.find((m) => m.id === e.currentTarget.value);
                props.setLLMModel(model ?? null);
              }}
            >
              <For each={props.llmModels()}>
                {(model: LLMModelInfo) => (
                  <option
                    value={model.id}
                    selected={props.llmModel()?.id === model.id}
                  >
                    {model.name}
                  </option>
                )}
              </For>
            </select>
          </Show>
        </div>
      </Show>
    </div>
  );
}
