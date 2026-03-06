import "./toolbeltNode.component.css";
import { Accessor, For, JSXElement, Show } from "solid-js";
import { MessageNodeConfig, ToolbeltToolConfig } from "../types/messageNode.interface";

type ToolDef = { name: string; label: string; description: string };

const FILES_TOOLS: ToolDef[] = [
  {
    name: "readFile",
    label: "readFile",
    description: "Read the full content of a named file from the active directory or clipboard.",
  },
  {
    name: "listFiles",
    label: "listFiles",
    description:
      "List all file names in the active directory and clipboard. Modified (unsaved) files are marked.",
  },
  {
    name: "searchFiles",
    label: "searchFiles",
    description:
      "Search for files by name substring (case-insensitive) in the active directory and clipboard.",
  },
  {
    name: "searchContent",
    label: "searchContent",
    description:
      "Search the text content of all files in the active directory for a query string. Returns file names with excerpts.",
  },
  {
    name: "searchByTag",
    label: "searchByTag",
    description:
      "Find files that have one or more hashtag labels in their name (e.g. #draft, #project). Matches files with ALL specified tags.",
  },
  {
    name: "createFile",
    label: "createFile",
    description: "Create a new file in the clipboard with a given name and text content.",
  },
  {
    name: "writeFile",
    label: "writeFile",
    description: "Write (create or overwrite) a text file in the active directory.",
  },
  {
    name: "appendToFile",
    label: "appendToFile",
    description:
      "Append text to the end of an existing file in the active directory without overwriting it.",
  },
  {
    name: "deleteFile",
    label: "deleteFile",
    description: "Permanently delete a file from the active directory.",
  },
  {
    name: "renameFile",
    label: "renameFile",
    description:
      "Rename a file in the active directory. Also used to add or remove hashtag labels in filenames.",
  },
  {
    name: "listDirectories",
    label: "listDirectories",
    description: "List all available storage directories.",
  },
  {
    name: "readFileFromDirectory",
    label: "readFileFromDirectory",
    description:
      "Read a file from a specific named directory (not just the active one). Use listDirectories first.",
  },
];

const WORKSPACE_TOOLS: ToolDef[] = [
  {
    name: "readWorkspace",
    label: "readWorkspace",
    description: "Read the full content of the currently viewed (active) file.",
  },
  {
    name: "appendWorkspace",
    label: "appendWorkspace",
    description:
      "Append text to the end of the currently viewed file (must be open for editing).",
  },
  {
    name: "overwriteWorkspace",
    label: "overwriteWorkspace",
    description:
      "Fully replace the content of the currently viewed file (must be open for editing).",
  },
  {
    name: "replaceInWorkspace",
    label: "replaceInWorkspace",
    description:
      "Find and replace all occurrences of a string in the currently viewed file. Token-efficient for targeted edits.",
  },
  {
    name: "getWorkspaceInfo",
    label: "getWorkspaceInfo",
    description:
      "Get metadata about the currently viewed file: name, tags, extension, save status, word count, character count.",
  },
];

const IMAGE_TOOLS: ToolDef[] = [
  {
    name: "generateImage",
    label: "generateImage",
    description:
      "Generate an image from a text prompt using ComfyUI (Flux) and save it to the active directory.",
  },
  {
    name: "generateImg2img",
    label: "generateImg2img",
    description:
      "Generate a new image based on an existing image and a text prompt using ComfyUI (Flux img2img).",
  },
];

const PRESET_URLS = [
  { label: "Local", url: "http://127.0.0.1:8188" },
];

function toolsForType(type: MessageNodeConfig["toolbeltType"]): ToolDef[] {
  if (type === "workspace") return WORKSPACE_TOOLS;
  if (type === "image") return IMAGE_TOOLS;
  return FILES_TOOLS;
}

function headerIcon(type: MessageNodeConfig["toolbeltType"]): string {
  if (type === "workspace") return "bx-edit";
  if (type === "image") return "bx-image-alt";
  return "bx-folder";
}

function headerLabel(type: MessageNodeConfig["toolbeltType"]): string {
  if (type === "workspace") return "Workspace";
  if (type === "image") return "Image Toolbelt";
  return "Files";
}

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
    props.onUpdate(node().id, {
      toolbeltTools: { ...node().toolbeltTools, [name]: { ...getToolConfig(name), ...updates } },
    });
  }

  function setImageConfig(updates: Partial<MessageNodeConfig["toolbeltImageConfig"]>) {
    props.onUpdate(node().id, {
      toolbeltImageConfig: { ...node().toolbeltImageConfig, ...updates },
    });
  }

  const tools = () => toolsForType(node().toolbeltType);
  const enabledCount = () => tools().filter((t) => getToolConfig(t.name).enabled).length;

  return (
    <div
      class={
        "ai_section pipeline_node toolbelt_" + node().toolbeltType +
        (node().collapsed ? " collapsed" : "") +
        (node().disabled ? " node_disabled" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() => props.onUpdate(node().id, { collapsed: !node().collapsed })}
      >
        <div class="left">
          <i class={"bx " + (node().collapsed ? "bx-chevron-right" : "bx-chevron-down")} />
          <i class={"bx toolbelt_type_icon " + headerIcon(node().toolbeltType)} />
          <span>
            {headerLabel(node().toolbeltType)}
            <Show when={enabledCount() > 0}>{" "}· {enabledCount()}</Show>
          </span>
        </div>
        <div class="right node_header_actions" onclick={(e) => e.stopPropagation()}>
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
          <i class="bx bx-x" onclick={() => props.onRemove(node().id)} title="Remove node" />
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
          <For each={tools()}>
            {(tool) => {
              const cfg = () => getToolConfig(tool.name);
              return (
                <div class={"toolbelt_tool_card" + (cfg().enabled ? " enabled" : "")}>
                  <div class="toolbelt_tool_header">
                    <label class="toolbelt_enable_label" onclick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={cfg().enabled}
                        onchange={(e) => setToolConfig(tool.name, { enabled: e.currentTarget.checked })}
                      />
                      <span class="toolbelt_tool_name">{tool.label}</span>
                    </label>
                  </div>
                  <p class="toolbelt_tool_desc">{tool.description}</p>
                </div>
              );
            }}
          </For>

          <Show when={node().toolbeltType === "image"}>
            <div class="toolbelt_image_settings">
              <div class="toolbelt_url_row">
                <For each={PRESET_URLS}>
                  {(preset) => (
                    <button
                      class={"preset_url_btn" + (node().toolbeltImageConfig.url === preset.url ? " active" : "")}
                      onclick={() => setImageConfig({ url: preset.url })}
                    >
                      {preset.label}
                    </button>
                  )}
                </For>
                <input
                  type="text"
                  value={node().toolbeltImageConfig.url}
                  placeholder="http://127.0.0.1:8188"
                  oninput={(e) => setImageConfig({ url: e.currentTarget.value })}
                />
              </div>
              <div class="toolbelt_image_dims">
                <span class="toolbelt_dim_label">W</span>
                <input
                  type="number"
                  class="toolbelt_dim_input"
                  value={node().toolbeltImageConfig.width}
                  min={64} step={64}
                  oninput={(e) => setImageConfig({ width: Number(e.currentTarget.value) })}
                />
                <span class="toolbelt_dim_label">H</span>
                <input
                  type="number"
                  class="toolbelt_dim_input"
                  value={node().toolbeltImageConfig.height}
                  min={64} step={64}
                  oninput={(e) => setImageConfig({ height: Number(e.currentTarget.value) })}
                />
                <label class="toolbelt_force_label" title="Lock resolution — ignore LLM-provided width/height">
                  <input
                    type="checkbox"
                    checked={node().toolbeltImageConfig.forceResolution}
                    onchange={(e) => setImageConfig({ forceResolution: e.currentTarget.checked })}
                  />
                  Lock
                </label>
                <span class="toolbelt_dim_label">Steps</span>
                <input
                  type="number"
                  class="toolbelt_dim_input"
                  value={node().toolbeltImageConfig.steps}
                  min={1} max={150}
                  oninput={(e) => setImageConfig({ steps: Number(e.currentTarget.value) })}
                />
                <label class="toolbelt_force_label" title="Lock steps — ignore LLM-provided steps count">
                  <input
                    type="checkbox"
                    checked={node().toolbeltImageConfig.forceSteps}
                    onchange={(e) => setImageConfig({ forceSteps: e.currentTarget.checked })}
                  />
                  Lock
                </label>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
