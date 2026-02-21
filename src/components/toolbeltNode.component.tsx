import { Accessor, For, JSXElement, Show } from "solid-js";
import { MessageNodeConfig, ToolbeltToolConfig } from "../types/messageNode.interface";

/** Definitions for all available tools */
const TOOL_DEFINITIONS: { name: string; label: string; description: string }[] = [
  {
    name: "readFile",
    label: "readFile",
    description: "return the content of file with given name",
  },
  {
    name: "listFiles",
    label: "listFiles",
    description: "return a list of readable fileNames",
  },
  {
    name: "write",
    label: "write",
    description: "appends to the end of the viewed file",
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
    return node().toolbeltTools[name] ?? { enabled: false, explained: false };
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
        <div class="prompt_body">
          <div class="toolbelt_tool_list">
            <div class="toolbelt_tool_header_row">
              <span class="toolbelt_tool_name_col" />
              <span class="toolbelt_tool_col_label" title="LLM may use this tool">Use</span>
              <span class="toolbelt_tool_col_label" title="LLM is given usage explanation">Info</span>
            </div>
            <For each={TOOL_DEFINITIONS}>
              {(tool) => (
                <div class="toolbelt_tool_row">
                  <span class="toolbelt_tool_name" title={tool.description}>
                    {tool.label}
                  </span>
                  <label
                    class="toolbelt_checkbox"
                    title="Allow LLM to use this tool"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={getToolConfig(tool.name).enabled}
                      onchange={(e) =>
                        setToolConfig(tool.name, { enabled: e.currentTarget.checked })
                      }
                    />
                  </label>
                  <label
                    class="toolbelt_checkbox"
                    title="Explain this tool's usage to the LLM"
                    onclick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={getToolConfig(tool.name).explained}
                      onchange={(e) =>
                        setToolConfig(tool.name, { explained: e.currentTarget.checked })
                      }
                    />
                  </label>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
