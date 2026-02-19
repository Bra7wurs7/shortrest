import { Message } from "ollama";
import { MessageNodeConfig } from "../../types/messageNode.interface";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import { HistoryTurn, PipelineInstance } from "../../hooks/usePipelineState";
import { getFileContent } from "../dbFilesInterface.functions";
import { truncateContent } from "../truncateContent.function";

export interface ResolveNodeMessagesOptions {
  nodes: MessageNodeConfig[];
  /** The central prompt input value (for "direct" acquisition mode) */
  directInputValue: string;
  /** Clipboard entries to search for file-mode nodes */
  clipboard: ClipboardEntry[];
  /** Active IDB directory name for file-mode lookups */
  activeDirectoryName: string | null;
  /** Currently displayed file content (for "viewed-file" acquisition mode) */
  displayedFileContent: string;
  /** All pipeline instances (for "pipeline-output" and "history" acquisition modes) */
  pipelines: PipelineInstance[];
  /** The pipeline that owns these nodes (used as fallback when sourcePipelineId is empty) */
  ownPipelineId: string;
}

/**
 * Resolves an ordered list of MessageNodeConfigs into an Ollama Message[].
 * Skips disabled nodes and nodes with empty resolved content.
 */
export async function resolveNodeMessages(
  options: ResolveNodeMessagesOptions,
): Promise<Message[]> {
  const {
    nodes,
    directInputValue,
    clipboard,
    activeDirectoryName,
    displayedFileContent,
    pipelines,
    ownPipelineId,
  } = options;

  const messages: Message[] = [];

  for (const node of nodes) {
    if (node.disabled) continue;

    // History nodes expand into multiple messages and are handled separately
    if (node.acquisitionMode === "history") {
      const source = pipelines.find((p) => p.id === ownPipelineId);
      const turns: HistoryTurn[] = source?.history() ?? [];
      for (const turn of turns) {
        if (turn.user) messages.push({ role: "user", content: turn.user });
        if (turn.assistant)
          messages.push({ role: "assistant", content: turn.assistant });
      }
      continue;
    }

    let content = "";

    switch (node.acquisitionMode) {
      case "direct":
        content = directInputValue;
        break;
      case "prepared":
        content = node.preparedContent;
        break;
      case "file": {
        const fileName = node.fileName.trim();
        if (!fileName) break;

        // Check clipboard first
        const clipboardEntry = clipboard.find((e) => e.name() === fileName);
        if (clipboardEntry) {
          content = clipboardEntry.content();
        } else if (activeDirectoryName) {
          // Fall back to IDB
          content = (await getFileContent(activeDirectoryName, fileName)) ?? "";
        }
        break;
      }
      case "viewed-file":
        content = truncateContent(
          displayedFileContent,
          node.truncateLength,
          node.truncateUnit,
        );
        break;
      case "pipeline-output": {
        const source = pipelines.find((p) => p.id === node.sourcePipelineId);
        content = source?.modelOutput() ?? "";
        break;
      }
    }

    if (content) {
      messages.push({ role: node.role, content });
    }
  }

  return messages;
}
