import { Accessor, Index, JSXElement, Match, Setter, Switch } from "solid-js";
import { AbortableAsyncIterator, ChatResponse, ModelResponse } from "ollama";
import { MessageNodeConfig } from "../types/messageNode.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { PipelineInstance } from "../hooks/usePipelineState";
import { MessageNode } from "./messageNode.component";
import { HistoryNode } from "./historyNode.component";
import { OllamaNode } from "./ollamaNode.component";
import { PipelineOutput } from "./pipelineOutput.component";

export interface NodePipelineProps {
  // Message nodes
  messageNodes: Accessor<MessageNodeConfig[]>;
  onUpdateNode: (id: string, updates: Partial<MessageNodeConfig>) => void;
  onRemoveNode: (id: string) => void;
  onMoveNode: (id: string, direction: "up" | "down") => void;
  // Ollama node
  ollamaNodeCollapsed: Accessor<boolean>;
  setOllamaNodeCollapsed: Setter<boolean>;
  ollamaUrl: Accessor<string>;
  setOllamaUrl: Setter<string>;
  ollamaModels: Accessor<ModelResponse[] | null>;
  ollamaModel: Accessor<ModelResponse | null>;
  setOllamaModel: Setter<ModelResponse | null>;
  promptLoading: Accessor<boolean>;
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>;
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
}

export function NodePipeline(props: NodePipelineProps): JSXElement {
  return (
    <div id="PIPELINE_SIDEBAR">
      <div id="P_S_TOP">
        <Index each={props.messageNodes()}>
          {(node, index) => (
            <Switch>
              <Match when={node().acquisitionMode === "history"}>
                <HistoryNode
                  node={node}
                  onUpdate={props.onUpdateNode}
                  onRemove={props.onRemoveNode}
                  pipelines={props.pipelines}
                  ownPipelineId={props.ownPipelineId}
                />
              </Match>
              <Match when={node().acquisitionMode !== "history"}>
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
        <OllamaNode
          collapsed={props.ollamaNodeCollapsed}
          setCollapsed={props.setOllamaNodeCollapsed}
          ollamaUrl={props.ollamaUrl}
          setOllamaUrl={props.setOllamaUrl}
          ollamaModels={props.ollamaModels}
          ollamaModel={props.ollamaModel}
          setOllamaModel={props.setOllamaModel}
          promptLoading={props.promptLoading}
          runningPrompt={props.runningPrompt}
          onSubmit={props.onSubmit}
        />
      </div>
      <div id="P_S_BOTTOM">
        <PipelineOutput
          modelThoughts={props.modelThoughts}
          modelOutput={props.modelOutput}
        />
      </div>
    </div>
  );
}
