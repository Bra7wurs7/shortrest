import "./llmNode.component.css";
import { Accessor, For, JSXElement, Match, Show, Switch } from "solid-js";
import { LLMModelInfo, LLMProviderType } from "../types/llmProvider.interface";
import { PipelineInstance } from "../hooks/usePipelineState";

const PRESET_URLS = [
  { label: "Local Ollama", url: "127.0.0.1:11434" },
  { label: "Mistral", url: "https://api.mistral.ai" },
];

export interface LlmNodeProps {
  pipeline: Accessor<PipelineInstance>;
  llmUrl: Accessor<string>;
  setLLMUrl: (url: string) => void;
  llmApiKey: Accessor<string>;
  setLLMApiKey: (key: string) => void;
  llmProviderType: Accessor<LLMProviderType>;
  llmModels: Accessor<LLMModelInfo[] | null>;
  onSubmit: () => void;
}

function providerIcon(type: LLMProviderType): string {
  switch (type) {
    case "mistral":
      return "bx-wind";
    default:
      return "bx-server";
  }
}

function providerLabel(type: LLMProviderType): string {
  switch (type) {
    case "mistral":
      return "Mistral";
    default:
      return "Ollama";
  }
}

export function LlmNode(props: LlmNodeProps): JSXElement {
  const p = props.pipeline;

  return (
    <div
      class={
        "pipeline_node ollama_node" +
        (p().ollamaNodeCollapsed() ? " collapsed" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() => p().setOllamaNodeCollapsed(!p().ollamaNodeCollapsed())}
      >
        <div class="left">
          <i
            class={
              "bx " +
              (p().ollamaNodeCollapsed()
                ? "bx-chevron-right"
                : "bx-chevron-down")
            }
          />
          <i class={"bx " + providerIcon(props.llmProviderType())} />
          <Switch
            fallback={<span>{providerLabel(props.llmProviderType())}</span>}
          >
            <Match when={p().promptLoading()}>
              <span class="llm_status_text">loading…</span>
            </Match>
            <Match when={p().runningPrompt() !== null}>
              <span class="llm_status_text">generating…</span>
            </Match>
          </Switch>
        </div>
        <div class="right" onclick={(e) => e.stopPropagation()}>
          <button
            class={"node_loop_btn" + (p().loopEnabled() ? " active" : "")}
            title={
              p().loopEnabled()
                ? "Loop: on — click to disable"
                : "Loop: off — click to enable"
            }
            onClick={() => p().setLoopEnabled(!p().loopEnabled())}
          >
            <i class="bx bx-repeat" />
          </button>
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
            <Match when={p().promptLoading()}>
              <button class="node_run_btn loading" disabled>
                <i class="bx bx-loader-alt bx-spin" />
              </button>
            </Match>
            <Match when={p().runningPrompt() !== null}>
              <button
                class="node_run_btn abort"
                onClick={() => p().runningPrompt()?.abort()}
                title="Abort"
              >
                <i class="bx bx-stop" />
              </button>
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={!p().ollamaNodeCollapsed()}>
        <div class="prompt_settings">
          <div class="settings_row">
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
              onchange={(e) => {
                const model = props
                  .llmModels()
                  ?.find((m) => m.id === e.currentTarget.value);
                p().setModel(model ?? null);
              }}
            >
              <For each={props.llmModels()}>
                {(model: LLMModelInfo) => (
                  <option
                    value={model.id}
                    selected={p().model()?.id === model.id}
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
