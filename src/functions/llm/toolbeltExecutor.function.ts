import { MessageNodeConfig } from "../../types/messageNode.interface";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import { getFileContent, listFileNamesInDirectory } from "../dbFilesInterface.functions";

export interface ToolbeltContext {
  /** Nodes from the active pipeline (used to find which tools are enabled) */
  nodes: MessageNodeConfig[];
  /** Clipboard entries for readFile / write */
  clipboard: ClipboardEntry[];
  /** Active IDB directory for readFile / listFiles */
  activeDirectoryName: string | null;
  /** Currently viewed file name (target for write) */
  viewedFileName: string | null;
  /** Called when the write tool appends content to the viewed clipboard file */
  onWrite: (appended: string) => void;
}

export interface ToolCall {
  name: string;
  arg: string | null;
}

/** Parse all <tool>name</tool><arg>value</arg> calls from LLM output */
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const toolPattern = /<tool>([\s\S]*?)<\/tool>(?:<arg>([\s\S]*?)<\/arg>)?/g;
  let match: RegExpExecArray | null;
  while ((match = toolPattern.exec(text)) !== null) {
    calls.push({ name: match[1].trim(), arg: match[2]?.trim() ?? null });
  }
  return calls;
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
  call: ToolCall,
  ctx: ToolbeltContext,
): Promise<string> {
  const allowed = enabledTools(ctx.nodes);

  if (!allowed.has(call.name)) {
    return `[Tool "${call.name}" is not available]`;
  }

  switch (call.name) {
    case "readFile": {
      const fileName = call.arg?.trim();
      if (!fileName) return "[readFile: no filename provided]";

      // Check clipboard first
      const entry = ctx.clipboard.find((e) => e.name() === fileName);
      if (entry) return entry.content();

      // Fall back to IDB
      if (ctx.activeDirectoryName) {
        const content = await getFileContent(ctx.activeDirectoryName, fileName);
        if (content !== null) return content;
      }
      return `[readFile: file "${fileName}" not found]`;
    }

    case "listFiles": {
      const clipboardNames = ctx.clipboard.map((e) => e.name());
      const idbNames = ctx.activeDirectoryName
        ? await listFileNamesInDirectory(ctx.activeDirectoryName)
        : [];
      const all = [...new Set([...clipboardNames, ...idbNames])];
      return all.length > 0 ? all.join("\n") : "[listFiles: no files found]";
    }

    case "write": {
      const text = call.arg ?? "";
      if (!ctx.viewedFileName) return "[write: no file is currently viewed]";
      ctx.onWrite(text);
      return `[write: appended to ${ctx.viewedFileName}]`;
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
