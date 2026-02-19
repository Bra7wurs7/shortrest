export type MessageRole = "system" | "assistant" | "user";
export type MessageAcquisitionMode =
  | "direct"
  | "prepared"
  | "file"
  | "viewed-file"
  | "pipeline-output";

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
  /** For "pipeline-output" mode: the ID of the pipeline whose output to use */
  sourcePipelineId: string;
  collapsed: boolean;
  disabled: boolean;
}
