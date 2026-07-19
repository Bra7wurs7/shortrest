import { MessageNodeConfig } from "../../types/messageNode.interface";
import { NativeTool, NativeToolCall } from "../../types/llmProvider.interface";
import { parseFileName } from "../parseFileName.function";

export interface ToolbeltContext {
  /** Nodes from the active pipeline (used to find which tools are enabled) */
  nodes: MessageNodeConfig[];
  /** Currently viewed file name */
  viewedFileName: string | null;
  /** Content of the currently viewed file (for readWorkspace) */
  viewedFileContent: string | null;
  /** True if the viewed file is a clipboard (unsaved) entry; false if saved IDB; null if no file */
  viewedFileModified: boolean | null;
  /** Called when appendWorkspace appends content to the viewed file */
  onAppendWorkspace: (appended: string) => void;
  /** Called when overwriteWorkspace replaces the full content of the viewed file */
  onOverwriteWorkspace: (content: string) => void;
}

/** Returns the set of tool names that are enabled across all toolbelt nodes */
function enabledTools(nodes: MessageNodeConfig[]): Set<string> {
  const enabled = new Set<string>();
  for (const node of nodes) {
    if (node.acquisitionMode === "toolbelt" && !node.disabled) {
      for (const [name, cfg] of Object.entries(node.toolbeltTools)) {
        if (cfg.enabled) enabled.add(name);
      }
    }
  }
  return enabled;
}

/** Execute a single tool call and return the result string */
export async function executeTool(
  call: NativeToolCall,
  ctx: ToolbeltContext,
): Promise<string> {
  const allowed = enabledTools(ctx.nodes);

  if (!allowed.has(call.name)) {
    return `[Tool "${call.name}" is not available]`;
  }

  switch (call.name) {
    case "readWorkspace": {
      if (ctx.viewedFileContent === null || ctx.viewedFileName === null) {
        return "[readWorkspace: no file is currently viewed]";
      }
      return ctx.viewedFileContent;
    }

    case "appendWorkspace": {
      const text = String(call.args.content ?? "");
      if (!ctx.viewedFileName)
        return "[appendWorkspace: no file is currently viewed]";
      if (!ctx.viewedFileModified)
        return "[appendWorkspace: file is saved — open it for editing first by clicking it in the file list]";
      ctx.onAppendWorkspace(text);
      return `[appendWorkspace: appended to "${ctx.viewedFileName}"]`;
    }

    case "overwriteWorkspace": {
      const content = String(call.args.content ?? "");
      if (!ctx.viewedFileName)
        return "[overwriteWorkspace: no file is currently viewed]";
      if (!ctx.viewedFileModified)
        return "[overwriteWorkspace: file is saved — open it for editing first by clicking it in the file list]";
      ctx.onOverwriteWorkspace(content);
      return `[overwriteWorkspace: replaced content of "${ctx.viewedFileName}"]`;
    }

    case "replaceInWorkspace": {
      const search = String(call.args.search ?? "");
      const replace = String(call.args.replace ?? "");
      if (!search) return "[replaceInWorkspace: no search string provided]";
      if (!ctx.viewedFileName)
        return "[replaceInWorkspace: no file is currently viewed]";
      if (!ctx.viewedFileModified)
        return "[replaceInWorkspace: file is saved — open it for editing first by clicking it in the file list]";
      if (ctx.viewedFileContent === null)
        return "[replaceInWorkspace: file content not available]";
      const count = ctx.viewedFileContent.split(search).length - 1;
      if (count === 0)
        return `[replaceInWorkspace: "${search}" not found in "${ctx.viewedFileName}"]`;
      const newContent = ctx.viewedFileContent.split(search).join(replace);
      ctx.onOverwriteWorkspace(newContent);
      return `[replaceInWorkspace: replaced ${count} occurrence${count !== 1 ? "s" : ""} in "${ctx.viewedFileName}"]`;
    }

    default:
      return `[Tool "${call.name}" is not recognised]`;
  }
}

/** Returns true if the pipeline has at least one enabled toolbelt node */
export function hasEnabledToolbelt(nodes: MessageNodeConfig[]): boolean {
  return nodes.some(
    (n) =>
      n.acquisitionMode === "toolbelt" &&
      !n.disabled &&
      Object.values(n.toolbeltTools).some((cfg) => cfg.enabled),
  );
}

/** Build native tool definitions for the LLM API from the enabled toolbelt tools */
export function buildNativeToolDefinitions(
  nodes: MessageNodeConfig[],
): NativeTool[] {
  const enabled = enabledTools(nodes);
  const tools: NativeTool[] = [];

  if (enabled.has("readWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "readWorkspace",
        description:
          "Returns the full content of the currently viewed (active) file.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (enabled.has("appendWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "appendWorkspace",
        description:
          "Appends text to the end of the currently viewed file. The file must be open for editing (click it in the file list first).",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "The text to append." },
          },
          required: ["content"],
        },
      },
    });
  }

  if (enabled.has("overwriteWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "overwriteWorkspace",
        description:
          "Fully replaces the content of the currently viewed file. The file must be open for editing. Prefer replaceInWorkspace for targeted edits.",
        parameters: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The new full content for the file.",
            },
          },
          required: ["content"],
        },
      },
    });
  }

  if (enabled.has("replaceInWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "replaceInWorkspace",
        description:
          "Finds and replaces all occurrences of a string in the currently viewed file. More token-efficient than a full overwrite for targeted edits. The file must be open for editing.",
        parameters: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "The exact string to find.",
            },
            replace: {
              type: "string",
              description: "The string to replace it with.",
            },
          },
          required: ["search", "replace"],
        },
      },
    });
  }

  return tools;
}
