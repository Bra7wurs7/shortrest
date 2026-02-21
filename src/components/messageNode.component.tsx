import { Accessor, For, JSXElement, Match, Show, Switch } from "solid-js";
import {
  MessageAcquisitionMode,
  MessageNodeConfig,
  MessageRole,
  SubPipelineParam,
} from "../types/messageNode.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { PipelineInstance } from "../hooks/usePipelineState";
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
  /** All pipeline instances for pipeline-output mode */
  pipelines: Accessor<PipelineInstance[]>;
  /** This node's own pipeline id (excluded from pipeline-output selection) */
  ownPipelineId: string;
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

  const isSubPipelineRunning = () =>
    node().acquisitionMode === "sub-pipeline" &&
    !!props
      .pipelines()
      .find((p) => p.id === node().sourcePipelineId)
      ?.subPipelineRunning();

  return (
    <div
      class={
        "ai_section pipeline_node" +
        (node().collapsed ? " collapsed" : "") +
        (node().acquisitionMode === "sub-pipeline" ? " sub_pipeline_node" : "") +
        (isSubPipelineRunning() ? " sub_running" : "")
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
            <Show when={node().acquisitionMode === "viewed-file"}>
              {" "}
              (viewed file)
            </Show>
            <Show when={node().acquisitionMode === "pipeline-output"}>
              {" "}
              (pipeline{" "}
              {props
                .pipelines()
                .findIndex((p) => p.id === node().sourcePipelineId) + 1 || "?"}
              )
            </Show>
            <Show when={node().acquisitionMode === "sub-pipeline"}>
              {" "}
              (sub-pipeline{" "}
              {props
                .pipelines()
                .findIndex((p) => p.id === node().sourcePipelineId) + 1 || "?"}
              )
            </Show>
          </span>
          <Show when={isSubPipelineRunning()}>
            <i class="bx bx-loader-alt bx-spin" />
          </Show>
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
              <option value="viewed-file">Viewed File</option>
              <option value="pipeline-output">Pipeline Output</option>
              <option value="sub-pipeline">Sub-Pipeline</option>
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
            <Match when={node().acquisitionMode === "viewed-file"}>
              <div class="prompt_settings">
                <div class="settings_row">
                  <input
                    class="truncate_length_input"
                    type="number"
                    value={node().truncateLength}
                    min={0}
                    step={1}
                    title="Max units to include from the end of the file (0 = all)"
                    onInput={(e) =>
                      props.onUpdate(node().id, {
                        truncateLength: Number(e.currentTarget.value),
                      })
                    }
                  />
                  <select
                    value={node().truncateUnit}
                    onChange={(e) =>
                      props.onUpdate(node().id, {
                        truncateUnit: e.currentTarget.value as
                          | "words"
                          | "sentences"
                          | "paragraphs"
                          | "all",
                      })
                    }
                  >
                    <option value="all">All</option>
                    <option value="words">Words</option>
                    <option value="sentences">Sentences</option>
                    <option value="paragraphs">Paragraphs</option>
                  </select>
                </div>
              </div>
              <div
                class={"readonly_prompt" + (node().disabled ? " disabled" : "")}
              >
                Uses currently viewed file
              </div>
            </Match>
            <Match when={node().acquisitionMode === "pipeline-output"}>
              <div class="prompt_settings">
                <div class="settings_row">
                  <select
                    value={node().sourcePipelineId}
                    onChange={(e) =>
                      props.onUpdate(node().id, {
                        sourcePipelineId: e.currentTarget.value,
                      })
                    }
                  >
                    <option value="">— select pipeline —</option>
                    <For each={props.pipelines()}>
                      {(p, i) => (
                        <Show when={p.id !== props.ownPipelineId}>
                          <option value={p.id}>Pipeline {i() + 1}</option>
                        </Show>
                      )}
                    </For>
                  </select>
                </div>
              </div>
              <div
                class={"readonly_prompt" + (node().disabled ? " disabled" : "")}
              >
                Uses output of selected pipeline
              </div>
            </Match>
            <Match when={node().acquisitionMode === "sub-pipeline"}>
              <div class="prompt_settings">
                <div class="settings_row">
                  <select
                    value={node().sourcePipelineId}
                    onChange={(e) =>
                      props.onUpdate(node().id, {
                        sourcePipelineId: e.currentTarget.value,
                      })
                    }
                  >
                    <option value="">— select pipeline —</option>
                    <For each={props.pipelines()}>
                      {(p, i) => (
                        <Show when={p.id !== props.ownPipelineId}>
                          <option value={p.id}>Pipeline {i() + 1}</option>
                        </Show>
                      )}
                    </For>
                  </select>
                </div>
              </div>
              <Show when={node().sourcePipelineId}>
                {() => {
                  const subPipeline = () =>
                    props
                      .pipelines()
                      .find((p) => p.id === node().sourcePipelineId);
                  const subNodes = () =>
                    subPipeline()?.messageNodes().filter(
                      (n) => n.acquisitionMode !== "history",
                    ) ?? [];

                  return (
                    <Show when={subNodes().length > 0}>
                      <div class="sub_pipeline_params">
                        <div class="params_label">Parameter overrides</div>
                        <For each={subNodes()}>
                          {(subNode) => {
                            const existingParam = () =>
                              node().subPipelineParams.find(
                                (p) => p.targetNodeId === subNode.id,
                              );
                            const preview =
                              subNode.preparedContent.trim().slice(0, 40) ||
                              subNode.acquisitionMode;

                            return (
                              <div class="param_row">
                                <span class="param_node_label">
                                  {subNode.role} · {preview}
                                </span>
                                <input
                                  type="text"
                                  class="param_value_input"
                                  placeholder="Leave blank to use sub-pipeline default"
                                  value={existingParam()?.value ?? ""}
                                  onInput={(e) => {
                                    const val = e.currentTarget.value;
                                    const updated: SubPipelineParam[] =
                                      node().subPipelineParams.filter(
                                        (p) => p.targetNodeId !== subNode.id,
                                      );
                                    if (val) {
                                      updated.push({
                                        targetNodeId: subNode.id,
                                        value: val,
                                      });
                                    }
                                    props.onUpdate(node().id, {
                                      subPipelineParams: updated,
                                    });
                                  }}
                                />
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  );
                }}
              </Show>
              <div
                class={"readonly_prompt" + (node().disabled ? " disabled" : "")}
              >
                Executes selected pipeline and uses its output
              </div>
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  );
}
