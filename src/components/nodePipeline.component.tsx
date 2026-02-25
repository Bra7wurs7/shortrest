import { Accessor, Index, JSXElement, Match, Setter, Switch } from "solid-js";
import { LLMAbortableStream, LLMModelInfo, LLMProviderType } from "../types/llmProvider.interface";
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
  // Message nodes
  messageNodes: Accessor<MessageNodeConfig[]>;
  onUpdateNode: (id: string, updates: Partial<MessageNodeConfig>) => void;
  onRemoveNode: (id: string) => void;
  onMoveNode: (id: string, direction: "up" | "down") => void;
  // LLM node
  ollamaNodeCollapsed: Accessor<boolean>;
  setOllamaNodeCollapsed: Setter<boolean>;
  llmUrl: Accessor<string>;
  setLLMUrl: Setter<string>;
  llmApiKey: Accessor<string>;
  setLLMApiKey: Setter<string>;
  llmProviderType: Accessor<LLMProviderType>;
  llmModels: Accessor<LLMModelInfo[] | null>;
  llmModel: Accessor<LLMModelInfo | null>;
  setLLMModel: (model: LLMModelInfo | null) => void;
  promptLoading: Accessor<boolean>;
  runningPrompt: Accessor<LLMAbortableStream | null>;
  onSubmit: () => void;

  // Output
  modelThoughts: Accessor<string>;
  modelOutput: Accessor<string>;

  // File autocompletion data
  clipboard: Accessor<ClipboardEntry[]>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;

  // Pipeline cross-reference data
  pipelines: Accessor<PipelineInstance[]>;
  ownPipelineId: string;

  // Running state for border highlight
  isRunning: Accessor<boolean>;
  onAbortSubPipeline: (pipelineId: string) => void;
}

export function NodePipeline(props: NodePipelineProps): JSXElement {
  return (
    <div id="PIPELINE_SIDEBAR" class={props.isRunning() ? "running" : ""}>
      <div id="P_S_TOP">
        <Index each={props.messageNodes()}>
          {(node, index) => (
            <Switch>
              <Match when={node().acquisitionMode === "history"}>
                <HistoryNode
                  node={node}
                  index={index}
                  totalNodes={props.messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                  pipelines={props.pipelines}
                  ownPipelineId={props.ownPipelineId}
                />
              </Match>
              <Match when={node().acquisitionMode === "toolbelt"}>
                <ToolbeltNode
                  node={node}
                  index={index}
                  totalNodes={props.messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                />
              </Match>
              <Match when={node().acquisitionMode !== "history" && node().acquisitionMode !== "toolbelt"}>
                <MessageNode
                  node={node}
                  index={index}
                  totalNodes={props.messageNodes().length}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  onMove={props.onMoveNode}
                  clipboard={props.clipboard}
                  activeDirectoryParsedFileNames={
                    props.activeDirectoryParsedFileNames
                  }
                  pipelines={props.pipelines}
                  ownPipelineId={props.ownPipelineId}
                />
              </Match>
            </Switch>
          )}
        </Index>
        <LlmNode
          collapsed={props.ollamaNodeCollapsed}
          setCollapsed={props.setOllamaNodeCollapsed}
          llmUrl={props.llmUrl}
          setLLMUrl={props.setLLMUrl}
          llmApiKey={props.llmApiKey}
          setLLMApiKey={props.setLLMApiKey}
          llmProviderType={props.llmProviderType}
          llmModels={props.llmModels}
          llmModel={props.llmModel}
          setLLMModel={props.setLLMModel}
          promptLoading={props.promptLoading}
          runningPrompt={props.runningPrompt}
          onSubmit={props.onSubmit}
        />
      </div>
      <div id="P_S_BOTTOM">
        <PipelineOutput
          modelThoughts={props.modelThoughts}
          modelOutput={props.modelOutput}
          messageNodes={props.messageNodes}
          pipelines={props.pipelines}
          onAbortSubPipeline={props.onAbortSubPipeline}
        />
      </div>
    </div>
  );
}
