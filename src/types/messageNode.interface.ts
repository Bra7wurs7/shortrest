export type MessageRole = "system" | "assistant" | "user";
export type MessageAcquisitionMode =
  | "direct"
  | "prepared"
  | "file"
  | "viewed-file"
  | "pipeline-output"
  | "history"
  | "sub-pipeline"
  | "toolbelt";

export interface ToolbeltToolConfig {
  /** Whether the LLM is allowed to use this tool */
  enabled: boolean;
}

/** A parameter override for a sub-pipeline node execution */
export interface SubPipelineParam {
  /** The node ID in the sub-pipeline whose content is overridden */
  targetNodeId: string;
  /** The static text to inject as that node's content */
  value: string;
}

export interface MessageNodeConfig {
  id: string;
  role: MessageRole;
  acquisitionMode: MessageAcquisitionMode;
  /** For "prepared" mode: the text content entered in the node's textarea */
  preparedContent: string;
  /** For "file" mode: the filename (autocompleted from left sidebar) */
  fileName: string;
  /** For "viewed-file" mode: max number of units to include (0 = all) */
  truncateLength: number;
  /** For "viewed-file" mode: unit for truncation */
  truncateUnit: "words" | "sentences" | "paragraphs" | "all";
  /** For "pipeline-output" and "sub-pipeline" modes: the ID of the pipeline to reference */
  sourcePipelineId: string;
  /** For "sub-pipeline" mode: parameter overrides passed to the sub-pipeline's nodes */
  subPipelineParams: SubPipelineParam[];
  collapsed: boolean;
  disabled: boolean;
  /** For "toolbelt" mode: per-tool configuration keyed by tool name */
  toolbeltTools: Record<string, ToolbeltToolConfig>;
  /** For "toolbelt" mode: which category of tools this node provides */
  toolbeltType: "miniagent";
}
