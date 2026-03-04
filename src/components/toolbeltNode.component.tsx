import "./toolbeltNode.component.css";
import { Accessor, For, JSXElement, Show } from "solid-js";
import { MessageNodeConfig, ToolbeltToolConfig } from "../types/messageNode.interface";

/** Definitions for all available tools */
const TOOL_DEFINITIONS: { name: string; label: string; description: string }[] = [
  {
    name: "readFile",
    label: "readFile",
    description: "Read the full content of a named file from the active directory or clipboard.",
  },
  {
    name: "listFiles",
    label: "listFiles",
    description: "List all file names available in the active directory and clipboard.",
  },
  {
    name: "write",
    label: "write",
    description: "Append text to the end of the currently viewed file.",
  },
  {
    name: "generateImage",
    label: "generateImage",
    description: "Generate an image via ComfyUI and save it to the active directory.",
  },
];

export interface ToolbeltNodeProps {
  node: Accessor<MessageNodeConfig>;
  index: number;
  totalNodes: number;
  onUpdate: (id: string, updates: Partial<MessageNodeConfig>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

export function ToolbeltNode(props: ToolbeltNodeProps): JSXElement {
  const node = props.node;

  function getToolConfig(name: string): ToolbeltToolConfig {
    return node().toolbeltTools[name] ?? { enabled: false };
  }

  function setToolConfig(name: string, updates: Partial<ToolbeltToolConfig>) {
    const current = getToolConfig(name);
    props.onUpdate(node().id, {
      toolbeltTools: {
        ...node().toolbeltTools,
        [name]: { ...current, ...updates },
      },
    });
  }

  const enabledCount = () =>
    TOOL_DEFINITIONS.filter((t) => getToolConfig(t.name).enabled).length;

  return (
    <div
      class={
        "ai_section pipeline_node" +
        (node().collapsed ? " collapsed" : "") +
        (node().disabled ? " node_disabled" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() => props.onUpdate(node().id, { collapsed: !node().collapsed })}
      >
        <div class="left">
          <i
            class={
              "bx " + (node().collapsed ? "bx-chevron-right" : "bx-chevron-down")
            }
          />
          <i class="bx bx-wrench" />
          <span>
            Toolbelt
            <Show when={enabledCount() > 0}>
              {" "}· {enabledCount()}
            </Show>
          </span>
        </div>
        <div
          class="right node_header_actions"
          onclick={(e) => e.stopPropagation()}
        >
          <i
            class={"bx bx-chevron-up" + (props.index === 0 ? " dim" : "")}
            onclick={() => props.onMove(node().id, "up")}
            title="Move up"
          />
          <i
            class={"bx bx-chevron-down" + (props.index === props.totalNodes - 1 ? " dim" : "")}
            onclick={() => props.onMove(node().id, "down")}
            title="Move down"
          />
          <i
            class="bx bx-x"
            onclick={() => props.onRemove(node().id)}
            title="Remove node"
          />
          <div
            class="toggle"
            onclick={() => props.onUpdate(node().id, { disabled: !node().disabled })}
          >
            <Show when={node().disabled} fallback={<i class="bx bx-check-square" />}>
              <i class="bx bx-square" />
            </Show>
          </div>
        </div>
      </div>
      <Show when={!node().collapsed}>
        <div class="prompt_body toolbelt_body">
          <For each={TOOL_DEFINITIONS}>
            {(tool) => {
              const cfg = () => getToolConfig(tool.name);
              return (
                <div class={"toolbelt_tool_card" + (cfg().enabled ? " enabled" : "")}>
                  <div class="toolbelt_tool_header">
                    <label
                      class="toolbelt_enable_label"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={cfg().enabled}
                        onchange={(e) =>
                          setToolConfig(tool.name, { enabled: e.currentTarget.checked })
                        }
                      />
                      <span class="toolbelt_tool_name">{tool.label}</span>
                    </label>
                  </div>
                  <p class="toolbelt_tool_desc">{tool.description}</p>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
