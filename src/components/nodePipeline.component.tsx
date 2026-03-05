import "./nodePipeline.component.css";
import { Accessor, Index, JSXElement, Match, Switch } from "solid-js";
import { LLMModelInfo, LLMProviderType } from "../types/llmProvider.interface";
import { MessageNodeConfig } from "../types/messageNode.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { PipelineInstance } from "../hooks/usePipelineState";
import { MessageNode } from "./messageNode.component";
import { HistoryNode } from "./historyNode.component";
import { ToolbeltNode } from "./toolbeltNode.component";
import { LlmNode } from "./llmNode.component";
import { PipelineOutput } from "./pipelineOutput.component";

export interface NodePipelineProps {
  // Active pipeline instance — owns all per-pipeline reactive state
  pipeline: Accessor<PipelineInstance>;

  // Node CRUD callbacks
  onUpdateNode: (id: string, updates: Partial<MessageNodeConfig>) => void;
  onRemoveNode: (id: string) => void;
  onMoveNode: (id: string, direction: "up" | "down") => void;

  // LLM connection (shared across pipelines)
  llmUrl: Accessor<string>;
  setLLMUrl: (url: string) => void;
  llmApiKey: Accessor<string>;
  setLLMApiKey: (key: string) => void;
  llmProviderType: Accessor<LLMProviderType>;
  llmModels: Accessor<LLMModelInfo[] | null>;
  onSubmit: () => void;

  // File autocompletion data
  clipboard: Accessor<ClipboardEntry[]>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;

  // All pipeline instances (for cross-pipeline references)
  pipelines: Accessor<PipelineInstance[]>;

  onAbortSubPipeline: (pipelineId: string) => void;
}

export function NodePipeline(props: NodePipelineProps): JSXElement {
  const p = props.pipeline;
  const isRunning = () => p().promptLoading() || p().runningPrompt() !== null;

  return (
    <div id="PIPELINE_SIDEBAR" class={isRunning() ? "running" : ""}>
      <div id="P_S_TOP">
        <Index each={p().messageNodes()}>
          {(node, index) => (
            <Switch>
              <Match when={node().acquisitionMode === "history"}>
                <HistoryNode
                  node={node}
                  index={index}
                  totalNodes={p().messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                  pipelines={props.pipelines}
                  ownPipelineId={p().id}
                />
              </Match>
              <Match when={node().acquisitionMode === "toolbelt"}>
                <ToolbeltNode
                  node={node}
                  index={index}
                  totalNodes={p().messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                />
              </Match>
              <Match
                when={
                  node().acquisitionMode !== "history" &&
                  node().acquisitionMode !== "toolbelt"
                }
              >
                <MessageNode
                  node={node}
                  index={index}
                  totalNodes={p().messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                  clipboard={props.clipboard}
                  activeDirectoryParsedFileNames={
                    props.activeDirectoryParsedFileNames
                  }
                  pipelines={props.pipelines}
                  ownPipelineId={p().id}
                />
              </Match>
            </Switch>
          )}
        </Index>
      </div>
      <div id="P_S_BOTTOM">
        <LlmNode
          pipeline={p}
          llmUrl={props.llmUrl}
          setLLMUrl={props.setLLMUrl}
          llmApiKey={props.llmApiKey}
          setLLMApiKey={props.setLLMApiKey}
          llmProviderType={props.llmProviderType}
          llmModels={props.llmModels}
          onSubmit={props.onSubmit}
        />
        <PipelineOutput
          pipeline={p}
          pipelines={props.pipelines}
          onAbortSubPipeline={props.onAbortSubPipeline}
        />
      </div>
    </div>
  );
}
