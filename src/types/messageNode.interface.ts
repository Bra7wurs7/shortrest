export type MessageRole = "system" | "assistant" | "user";
export type MessageAcquisitionMode = "direct" | "prepared" | "file";

export interface MessageNodeConfig {
  id: string;
  role: MessageRole;
  acquisitionMode: MessageAcquisitionMode;
  /** For "prepared" mode: the text content entered in the node's textarea */
  preparedContent: string;
  /** For "file" mode: the filename (autocompleted from left sidebar) */
  fileName: string;
  collapsed: boolean;
  disabled: boolean;
}
