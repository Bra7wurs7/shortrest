import {
  Accessor,
  For,
  JSXElement,
  Match,
  Setter,
  Show,
  Switch,
} from "solid-js";
import { AbortableAsyncIterator, ChatResponse, ModelResponse, Ollama } from "ollama";

export interface OllamaNodeProps {
  collapsed: Accessor<boolean>;
  setCollapsed: Setter<boolean>;
  ollamaUrl: Accessor<string>;
  setOllamaUrl: Setter<string>;
  ollamaModels: Accessor<ModelResponse[] | null>;
  ollamaModel: Accessor<ModelResponse | null>;
  setOllamaModel: (model: ModelResponse | null) => void;
  promptLoading: Accessor<boolean>;
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>;
  onSubmit: () => void;
}

export function OllamaNode(props: OllamaNodeProps): JSXElement {
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
          <i class="bx bx-server" />
          <span>Ollama</span>
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
              <button class="node_run_btn" disabled>
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
          <div class="settings_row">
            <input
              value={props.ollamaUrl()}
              onchange={(e) => props.setOllamaUrl(e.currentTarget.value)}
              placeholder="127.0.0.1:11434"
            />
          </div>
        </div>
        <div class="prompt_body">
          <Show
            when={props.ollamaModels() && props.ollamaModels()!.length > 0}
            fallback={
              <div class="no_models_message">
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
              </div>
            }
          >
            <select
              class="model_select"
              onchange={(e) => {
                const model = props
                  .ollamaModels()
                  ?.find((m) => m.model === e.currentTarget.value);
                props.setOllamaModel(model ?? null);
              }}
            >
              <For each={props.ollamaModels()}>
                {(model: ModelResponse) => (
                  <option
                    value={model.model}
                    selected={props.ollamaModel()?.model === model.model}
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
