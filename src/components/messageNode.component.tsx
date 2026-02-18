import { Accessor, JSXElement, Match, Show, Switch } from "solid-js";
import {
  MessageAcquisitionMode,
  MessageNodeConfig,
  MessageRole,
} from "../types/messageNode.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { longestCommonPrefix } from "../functions/longestCommonPrefix.function";

export interface MessageNodeProps {
  node: Accessor<MessageNodeConfig>;
  index: number;
  totalNodes: number;
  onUpdate: (id: string, updates: Partial<MessageNodeConfig>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  /** All clipboard file names for file-mode autocompletion */
  clipboard: Accessor<ClipboardEntry[]>;
  /** All directory file names for file-mode autocompletion */
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
}

export function MessageNode(props: MessageNodeProps): JSXElement {
  const node = props.node;

  function getAllFileNames(): string[] {
    const clipNames = props.clipboard().map((e) => e.name());
    const dirNames = (props.activeDirectoryParsedFileNames() ?? []).map(
      (f) => f.fullName,
    );
    return [...clipNames, ...dirNames];
  }

  function getFilteredFileNames(query: string): string[] {
    const lower = query.toLowerCase();
    return getAllFileNames().filter((n) => n.toLowerCase().includes(lower));
  }

  function handleFileInputKeyDown(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    if (e.key === "Tab") {
      e.preventDefault();
      const query = e.currentTarget.value;
      const matches = getFilteredFileNames(query);
      if (matches.length === 0) return;

      const completion = longestCommonPrefix(matches);
      if (completion.length <= query.length) return;

      props.onUpdate(node().id, { fileName: completion });
    }
  }

  const roleLabel = () => {
    switch (node().role) {
      case "system":
        return "System";
      case "assistant":
        return "Assistant";
      case "user":
        return "User";
    }
  };

  const roleIcon = () => {
    switch (node().role) {
      case "system":
        return "bx-info-circle";
      case "assistant":
        return "bx-bot";
      case "user":
        return "bxs-user-voice";
    }
  };

  return (
    <div
      class={
        "ai_section pipeline_node" + (node().collapsed ? " collapsed" : "")
      }
    >
      <div
        class="prompt_header"
        onclick={() =>
          props.onUpdate(node().id, { collapsed: !node().collapsed })
        }
      >
        <div class="left">
          <i
            class={
              "bx " +
              (node().collapsed ? "bx-chevron-right" : "bx-chevron-down")
            }
          />
          <i class={"bx " + roleIcon()} />
          <span>
            {roleLabel()}
            <Show when={node().acquisitionMode === "direct"}> (prompt)</Show>
            <Show when={node().acquisitionMode === "file"}>
              {" "}
              [{node().fileName || "..."}]
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
            class={
              "bx bx-chevron-down" +
              (props.index === props.totalNodes - 1 ? " dim" : "")
            }
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
            onclick={() =>
              props.onUpdate(node().id, { disabled: !node().disabled })
            }
          >
            <Switch>
              <Match when={node().disabled}>
                <i class="bx bx-square" />
              </Match>
              <Match when={!node().disabled}>
                <i class="bx bx-check-square" />
              </Match>
            </Switch>
          </div>
        </div>
      </div>
      <Show when={!node().collapsed}>
        <div class="prompt_settings">
          <div class="settings_row node_controls">
            <select
              value={node().role}
              onChange={(e) =>
                props.onUpdate(node().id, {
                  role: e.currentTarget.value as MessageRole,
                })
              }
            >
              <option value="system">System</option>
              <option value="assistant">Assistant</option>
              <option value="user">User</option>
            </select>
            <select
              value={node().acquisitionMode}
              onChange={(e) =>
                props.onUpdate(node().id, {
                  acquisitionMode: e.currentTarget
                    .value as MessageAcquisitionMode,
                })
              }
            >
              <option value="direct">Prompt Input</option>
              <option value="prepared">Text</option>
              <option value="file">File</option>
            </select>
          </div>
        </div>
        <div class="prompt_body">
          <Switch>
            <Match when={node().acquisitionMode === "direct"}>
              <div
                class={"readonly_prompt" + (node().disabled ? " disabled" : "")}
              >
                Uses central prompt input
              </div>
            </Match>
            <Match when={node().acquisitionMode === "prepared"}>
              <textarea
                class={"prompt" + (node().disabled ? " disabled" : "")}
                rows={5}
                value={node().preparedContent}
                onInput={(e) =>
                  props.onUpdate(node().id, {
                    preparedContent: e.currentTarget.value,
                  })
                }
                placeholder="Enter message content..."
              />
            </Match>
            <Match when={node().acquisitionMode === "file"}>
              <input
                class={
                  "file_input prompt" + (node().disabled ? " disabled" : "")
                }
                type="text"
                value={node().fileName}
                onInput={(e) =>
                  props.onUpdate(node().id, {
                    fileName: e.currentTarget.value,
                  })
                }
                onKeyDown={handleFileInputKeyDown}
                placeholder="Type filename, Tab to complete..."
              />
              <Show when={node().fileName.trim()}>
                <div class="file_suggestions">
                  {getFilteredFileNames(node().fileName)
                    .slice(0, 5)
                    .map((name) => (
                      <div
                        class="suggestion"
                        onclick={() =>
                          props.onUpdate(node().id, { fileName: name })
                        }
                      >
                        {name}
                      </div>
                    ))}
                </div>
              </Show>
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  );
}
