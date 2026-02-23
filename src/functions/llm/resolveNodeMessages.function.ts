import { AbortableAsyncIterator, ChatResponse, Message, Ollama, ModelResponse } from "ollama";
import { MessageNodeConfig, ToolbeltToolConfig } from "../../types/messageNode.interface";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import { HistoryTurn, PipelineInstance } from "../../hooks/usePipelineState";
import { getFileContent } from "../dbFilesInterface.functions";
import { truncateContent } from "../truncateContent.function";
import { runSubPipeline } from "./runSubPipeline.function";

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
  /** All pipeline instances (for "pipeline-output" and "sub-pipeline" acquisition modes) */
  pipelines: PipelineInstance[];
  /** History turns from the owning pipeline, injected by history nodes */
  ownHistory: HistoryTurn[];
  /** Ollama connection — required for "sub-pipeline" mode */
  ollama: Ollama | null;
  /** Selected model — required for "sub-pipeline" mode */
  model: ModelResponse | null;
  /** ID of the pipeline that owns these nodes — used for cycle detection */
  ownPipelineId?: string;
  /** Internal: pipeline IDs currently on the call stack, for cycle detection */
  _callStack?: ReadonlySet<string>;
  /**
   * Called when a sub-pipeline starts or finishes.
   * On start: running=true, stream=the live iterator (can be aborted).
   * On finish: running=false, output=accumulated result string.
   */
  onSubPipelineStateChange?: (
    pipelineId: string,
    running: boolean,
    streamOrOutput: AbortableAsyncIterator<ChatResponse> | string,
  ) => void;
}

interface ToolDefinition {
  name: string;
  description: string;
  usage: string;
}

const TOOLBELT_DEFINITIONS: ToolDefinition[] = [
  {
    name: "readFile",
    description: "Returns the full content of a file given its name.",
    usage: 'To read a file, output exactly: <tool>readFile</tool><arg>filename</arg>',
  },
  {
    name: "listFiles",
    description: "Returns a list of all readable file names.",
    usage: 'To list files, output exactly: <tool>listFiles</tool>',
  },
  {
    name: "write",
    description: "Appends text to the end of the currently viewed file.",
    usage:
      "To append to the viewed file, place the full content inside <arg> tags immediately after </tool>. " +
      "The closing </arg> tag must appear right after the last character of content — do not add any commentary after it. Example:\n" +
      "<tool>write</tool><arg>Line one\nLine two\n</arg>",
  },
];

function buildToolbeltMessage(tools: Record<string, ToolbeltToolConfig>): string {
  const enabledTools = TOOLBELT_DEFINITIONS.filter(
    (t) => tools[t.name]?.enabled,
  );
  const explainedTools = TOOLBELT_DEFINITIONS.filter(
    (t) => tools[t.name]?.explained,
  );

  if (enabledTools.length === 0) return "";

  const lines: string[] = [];
  lines.push("You have access to the following tools:");
  lines.push("");

  for (const tool of enabledTools) {
    lines.push(`- ${tool.name}: ${tool.description}`);
  }

  if (explainedTools.length > 0) {
    lines.push("");
    lines.push("Usage:");
    for (const tool of explainedTools) {
      if (tools[tool.name]?.enabled) {
        lines.push(`  ${tool.usage}`);
      }
    }
  }

  return lines.join("\n");
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
    ownHistory,
  } = options;

  // Build call stack for cycle detection: seed with own pipeline ID if provided
  const callStack: ReadonlySet<string> =
    options._callStack ??
    (options.ownPipelineId
      ? new Set([options.ownPipelineId])
      : new Set<string>());

  const messages: Message[] = [];

  for (const node of nodes) {
    if (node.disabled) continue;

    // History nodes expand into multiple messages and are handled separately
    if (node.acquisitionMode === "history") {
      for (const turn of ownHistory) {
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
      case "toolbelt":
        content = buildToolbeltMessage(node.toolbeltTools ?? {});
        break;
      case "sub-pipeline": {
        if (!options.ollama || !options.model) break;

        const subPipeline = pipelines.find(
          (p) => p.id === node.sourcePipelineId,
        );
        if (!subPipeline) break;

        // Cycle detection
        if (callStack.has(subPipeline.id)) {
          console.warn(
            `Sub-pipeline cycle detected: pipeline "${subPipeline.id}" is already in the call stack. Skipping.`,
          );
          break;
        }

        // Apply parameter overrides: replace overridden nodes with prepared content
        const overrides = new Map(
          node.subPipelineParams.map((p) => [p.targetNodeId, p.value]),
        );
        const subNodes = subPipeline.messageNodes().map(
          (n): MessageNodeConfig => {
            const override = overrides.get(n.id);
            if (override !== undefined) {
              return {
                ...n,
                acquisitionMode: "prepared",
                preparedContent: override,
              };
            }
            return n;
          },
        );

        // Recursively resolve sub-pipeline messages.
        // Always pass empty history — sub-pipelines are stateless function calls;
        // their accumulated interactive history must not bleed into programmatic execution.
        // Pass through directInputValue so "direct" mode nodes receive the parent's prompt.
        const subMessages = await resolveNodeMessages({
          nodes: subNodes,
          directInputValue: options.directInputValue,
          clipboard: options.clipboard,
          activeDirectoryName: options.activeDirectoryName,
          displayedFileContent: options.displayedFileContent,
          pipelines: options.pipelines,
          ownHistory: [],
          ollama: options.ollama,
          model: options.model,
          ownPipelineId: subPipeline.id,
          _callStack: new Set([...callStack, subPipeline.id]),
          onSubPipelineStateChange: options.onSubPipelineStateChange,
        });

        if (subMessages.length === 0) {
          console.warn(
            `Sub-pipeline "${subPipeline.id}" resolved to no messages — check that its nodes have non-empty content or are overridden via subPipelineParams. Skipping.`,
          );
          break;
        }

        // Use the sub-pipeline's own model if set, otherwise fall back to the calling model
        const subModel = subPipeline.ollamaModel() ?? options.model;
        if (!subModel) break;

        try {
          content = await runSubPipeline({
            ollama: options.ollama,
            model: subModel,
            messages: subMessages,
            onStream: (stream) => {
              options.onSubPipelineStateChange?.(subPipeline.id, true, stream);
            },
          });
          options.onSubPipelineStateChange?.(subPipeline.id, false, content);
        } catch (e) {
          options.onSubPipelineStateChange?.(subPipeline.id, false, "");
          throw e;
        }
        break;
      }
    }

    if (content) {
      messages.push({ role: node.role, content });
    }
  }

  return messages;
}
