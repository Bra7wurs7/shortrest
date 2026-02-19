import { Accessor, For, JSXElement, Show } from "solid-js";
import { HistoryTurn, PipelineInstance } from "../hooks/usePipelineState";

export interface HistoryNodeProps {
  node: Accessor<{ id: string; collapsed: boolean; disabled: boolean }>;
  index: number;
  totalNodes: number;
  onUpdate: (id: string, updates: { collapsed?: boolean; disabled?: boolean }) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  pipelines: Accessor<PipelineInstance[]>;
  ownPipelineId: string;
}

export function HistoryNode(props: HistoryNodeProps): JSXElement {
  const node = props.node;

  const ownPipeline = () =>
    props.pipelines().find((p) => p.id === props.ownPipelineId);

  const turns = (): HistoryTurn[] => ownPipeline()?.history() ?? [];

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
          <i class="bx bx-history" />
          <span>
            History
            <Show when={turns().length > 0}>
              {" "}· {turns().length}
            </Show>
          </span>
        </div>
        <div
          class="right node_header_actions"
          onclick={(e) => e.stopPropagation()}
        >
          <i
            class="bx bx-eraser"
            onclick={() => ownPipeline()?.setHistory([])}
            title="Clear history"
          />
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
          <Show
            when={turns().length > 0}
            fallback={
              <div class="readonly_prompt history_empty">No history yet</div>
            }
          >
            <div class="history_turns">
              <For each={turns()}>
                {(turn, i) => (
                  <div class="history_turn">
                    <div class="history_turn_label">
                      <i class="bx bxs-user-voice" />
                      {i() + 1}
                    </div>
                    <div class="history_turn_user">{turn.user}</div>
                    <div class="history_turn_label">
                      <i class="bx bx-bot" />
                    </div>
                    <div class="history_turn_assistant">{turn.assistant}</div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
