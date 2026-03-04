import "./comfyuiNode.component.css";
import { Accessor, For, JSXElement, Show } from "solid-js";
import { ComfyuiConfig, ComfyuiPromptSource, PipelineInstance } from "../hooks/usePipelineState";

const PRESET_URLS = [
  { label: "Local ComfyUI", url: "http://127.0.0.1:8188" },
];

const PROMPT_SOURCE_LABELS: Record<ComfyuiPromptSource, string> = {
  "llm-output": "LLM output",
  "user-prompt": "User prompt",
  prepared: "Prepared text",
};

export interface ComfyuiNodeProps {
  pipeline: Accessor<PipelineInstance>;
  comfyuiUrl: Accessor<string>;
  setComfyuiUrl: (url: string) => void;
}

export function ComfyuiNode(props: ComfyuiNodeProps): JSXElement {
  const p = props.pipeline;
  const cfg = () => p().comfyuiConfig();

  function update(patch: Partial<ComfyuiConfig>) {
    p().setComfyuiConfig({ ...cfg(), ...patch });
  }

  return (
    <div
      class={
        "ai_section pipeline_node comfyui_node" +
        (cfg().collapsed ? " collapsed" : "") +
        (!cfg().enabled ? " node_disabled" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() => update({ collapsed: !cfg().collapsed })}
      >
        <div class="left">
          <i class={"bx " + (cfg().collapsed ? "bx-chevron-right" : "bx-chevron-down")} />
          <i class="bx bx-image-alt" />
          <span>ComfyUI</span>
        </div>
        <div class="right node_header_actions" onclick={(e) => e.stopPropagation()}>
          <div
            class="toggle"
            title={cfg().enabled ? "Disable image generation" : "Enable image generation"}
            onclick={() => update({ enabled: !cfg().enabled })}
          >
            <Show when={cfg().enabled} fallback={<i class="bx bx-square" />}>
              <i class="bx bx-check-square" />
            </Show>
          </div>
        </div>
      </div>
      <Show when={!cfg().collapsed}>
        <div class="prompt_settings">
          <div class="settings_row preset_buttons">
            <For each={PRESET_URLS}>
              {(preset) => (
                <button
                  class={"preset_url_btn" + (props.comfyuiUrl() === preset.url ? " active" : "")}
                  onClick={() => props.setComfyuiUrl(preset.url)}
                  title={preset.url}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
          <div class="settings_row">
            <input
              value={props.comfyuiUrl()}
              onchange={(e) => props.setComfyuiUrl(e.currentTarget.value)}
              placeholder="http://127.0.0.1:8188"
            />
          </div>
          <div class="comfyui_section">
            <div class="settings_row">
              <span class="comfyui_label">Prompt</span>
              <div class="comfyui_source_btns">
                {(["llm-output", "user-prompt", "prepared"] as ComfyuiPromptSource[]).map((src) => (
                  <button
                    class={"preset_url_btn" + (cfg().promptSource === src ? " active" : "")}
                    onclick={() => update({ promptSource: src })}
                  >
                    {PROMPT_SOURCE_LABELS[src]}
                  </button>
                ))}
              </div>
            </div>
            <Show when={cfg().promptSource === "prepared"}>
              <div class="settings_row">
                <textarea
                  class="comfyui_textarea"
                  placeholder="Prepared image prompt…"
                  value={cfg().preparedPrompt}
                  oninput={(e) => update({ preparedPrompt: e.currentTarget.value })}
                  rows={3}
                />
              </div>
            </Show>
            <div class="settings_row">
              <span class="comfyui_label">Filename</span>
              <input
                value={cfg().filename}
                oninput={(e) => update({ filename: e.currentTarget.value })}
                placeholder="generated.png"
              />
            </div>
            <div class="settings_row comfyui_dims">
              <label class="comfyui_dim_label">
                W
                <input
                  class="comfyui_dim_input"
                  type="number"
                  value={cfg().width}
                  min={64}
                  step={64}
                  oninput={(e) => update({ width: parseInt(e.currentTarget.value) || 768 })}
                />
              </label>
              <label class="comfyui_dim_label">
                H
                <input
                  class="comfyui_dim_input"
                  type="number"
                  value={cfg().height}
                  min={64}
                  step={64}
                  oninput={(e) => update({ height: parseInt(e.currentTarget.value) || 768 })}
                />
              </label>
              <label class="comfyui_dim_label">
                Steps
                <input
                  class="comfyui_dim_input"
                  type="number"
                  value={cfg().steps}
                  min={1}
                  max={100}
                  oninput={(e) => update({ steps: parseInt(e.currentTarget.value) || 7 })}
                />
              </label>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
