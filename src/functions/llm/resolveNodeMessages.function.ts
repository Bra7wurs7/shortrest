import { LLMAbortableStream, LLMModelInfo, LLMProvider } from "../../types/llmProvider.interface";
import { Message } from "ollama";
import { MessageNodeConfig } from "../../types/messageNode.interface";
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
  /** LLM provider — required for "sub-pipeline" mode */
  provider: LLMProvider | null;
  /** Selected model — required for "sub-pipeline" mode */
  model: LLMModelInfo | null;
  /** ID of the pipeline that owns these nodes — used for cycle detection */
  ownPipelineId?: string;
  /** Internal: pipeline IDs currently on the call stack, for cycle detection */
  _callStack?: ReadonlySet<string>;
  /**
   * Called immediately before a sub-pipeline's LLM request is sent (before the
   * stream opens). Use this to show a loading indicator.
   */
  onSubPipelineLoading?: (pipelineId: string) => void;
  /**
   * Called when a sub-pipeline starts or finishes.
   * On start: running=true, stream=the live iterator (can be aborted).
   * On finish: running=false, output=accumulated result string.
   */
  onSubPipelineStateChange?: (
    pipelineId: string,
    running: boolean,
    streamOrOutput: LLMAbortableStream | string,
  ) => void;
}

/** Build and start a single sub-pipeline, returning a promise for its output. */
async function startSubPipeline(
  node: MessageNodeConfig,
  options: ResolveNodeMessagesOptions,
  callStack: ReadonlySet<string>,
): Promise<string> {
  if (!options.provider || !options.model) return "";

  const { pipelines } = options;
  const subPipeline = pipelines.find((p) => p.id === node.sourcePipelineId);
  if (!subPipeline) return "";

  if (callStack.has(subPipeline.id)) {
    console.warn(
      `Sub-pipeline cycle detected: pipeline "${subPipeline.id}" is already in the call stack. Skipping.`,
    );
    return "";
  }

  const overrides = new Map(
    node.subPipelineParams.map((p) => [p.targetNodeId, p.value]),
  );
  const subNodes = subPipeline.messageNodes().map(
    (n): MessageNodeConfig => {
      const override = overrides.get(n.id);
      if (override !== undefined) {
        return { ...n, acquisitionMode: "prepared", preparedContent: override };
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
    provider: options.provider,
    model: options.model,
    ownPipelineId: subPipeline.id,
    _callStack: new Set([...callStack, subPipeline.id]),
    onSubPipelineLoading: options.onSubPipelineLoading,
    onSubPipelineStateChange: options.onSubPipelineStateChange,
  });

  if (subMessages.length === 0) {
    console.warn(
      `Sub-pipeline "${subPipeline.id}" resolved to no messages — check that its nodes have non-empty content or are overridden via subPipelineParams. Skipping.`,
    );
    return "";
  }

  const subModel = subPipeline.model() ?? options.model;
  if (!subModel) return "";

  options.onSubPipelineLoading?.(subPipeline.id);
  try {
    const content = await runSubPipeline({
      provider: options.provider!,
      model: subModel,
      messages: subMessages,
      onStream: (stream) => {
        options.onSubPipelineStateChange?.(subPipeline.id, true, stream);
      },
    });
    options.onSubPipelineStateChange?.(subPipeline.id, false, content);
    return content;
  } catch (e) {
    options.onSubPipelineStateChange?.(subPipeline.id, false, "");
    throw e;
  }
}

/**
 * Resolves an ordered list of MessageNodeConfigs into an Ollama Message[].
 * Skips disabled nodes and nodes with empty resolved content.
 * Toolbelt nodes are skipped here — they contribute tool definitions to the API
 * call (via buildNativeToolDefinitions) rather than injecting prompt messages.
 * Sub-pipeline nodes are all started in parallel and awaited in order,
 * so multiple sub-pipelines run concurrently while message ordering is preserved.
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

  // Pass 1: kick off all sub-pipeline executions in parallel, indexed by node position.
  // Non-sub-pipeline nodes get null so the array stays aligned with `nodes`.
  const subPipelinePromises: (Promise<string> | null)[] = nodes.map((node) => {
    if (node.disabled || node.acquisitionMode !== "sub-pipeline") return null;
    return startSubPipeline(node, options, callStack);
  });

  // Pass 2: resolve all nodes in order, awaiting each sub-pipeline promise as we reach it.
  const messages: Message[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
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

    // Toolbelt nodes do not produce prompt messages — they signal which native
    // tools to attach to the API request (handled by buildNativeToolDefinitions).
    if (node.acquisitionMode === "toolbelt") continue;

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
      case "sub-pipeline":
        // Promise was started in pass 1; await it now to get the result in order.
        content = await (subPipelinePromises[i] ?? Promise.resolve(""));
        break;
    }

    if (content) {
      messages.push({ role: node.role, content });
    }
  }

  return messages;
}
