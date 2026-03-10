import { MessageNodeConfig } from "../../types/messageNode.interface";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import {
  getFileContent,
  listFileNamesInDirectory,
  listAllDirectories,
  removeFileFromDirectory,
} from "../dbFilesInterface.functions";
import { NativeTool, NativeToolCall } from "../../types/llmProvider.interface";
import { FluxClient, randomSeed } from "../../comfyui/index";
import { parseFileName } from "../parseFileName.function";

export interface ToolbeltContext {
  /** Nodes from the active pipeline (used to find which tools are enabled) */
  nodes: MessageNodeConfig[];
  /** Clipboard entries for file tools */
  clipboard: ClipboardEntry[];
  /** Active IDB directory for file tools / image generation */
  activeDirectoryName: string | null;
  /** Currently viewed file name */
  viewedFileName: string | null;
  /** Content of the currently viewed file (for readWorkspace) */
  viewedFileContent: string | null;
  /** True if the viewed file is a clipboard (unsaved) entry; false if saved IDB; null if no file */
  viewedFileModified: boolean | null;
  /** Blob of the currently viewed binary file (e.g. an image), or null if text/nothing viewed */
  viewedFileBlob: Blob | null;
  /** Called when appendWorkspace appends content to the viewed file */
  onAppendWorkspace: (appended: string) => void;
  /** Called when overwriteWorkspace replaces the full content of the viewed file */
  onOverwriteWorkspace: (content: string) => void;
  /** Called when createFile creates a new clipboard entry */
  onCreateClipboardFile: (name: string, content: string) => void;
  /** Called when writeFile / appendToFile writes text content to the active IDB directory */
  onWriteFile: (name: string, content: string) => Promise<void>;
  /** Called when deleteFile removes a file from the active IDB directory */
  onDeleteFile: (name: string) => Promise<void>;
  /** Called when renameFile renames a file in the active IDB directory */
  onRenameFile: (oldName: string, newName: string) => Promise<void>;
  /** Called when generateImage/generateImg2img produces a Blob to save to IDB */
  onImageGenerated: (filename: string, blob: Blob) => Promise<void>;
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

/** Returns the image toolbelt config from the first enabled image toolbelt node */
function getImageToolbeltConfig(nodes: MessageNodeConfig[]) {
  return nodes.find(
    (n) => n.acquisitionMode === "toolbelt" && n.toolbeltType === "image" && !n.disabled,
  )?.toolbeltImageConfig ?? null;
}

/** Find up to maxMatches occurrences of lowerQuery in content and return excerpts */
function findExcerpts(
  content: string,
  lowerQuery: string,
  maxMatches = 3,
  contextLen = 80,
): string[] {
  const lowerContent = content.toLowerCase();
  const excerpts: string[] = [];
  let searchFrom = 0;

  while (excerpts.length < maxMatches) {
    const idx = lowerContent.indexOf(lowerQuery, searchFrom);
    if (idx === -1) break;

    const start = Math.max(0, idx - contextLen);
    const end = Math.min(content.length, idx + lowerQuery.length + contextLen);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < content.length ? "..." : "";
    const before = content.slice(start, idx);
    const match = content.slice(idx, idx + lowerQuery.length);
    const after = content.slice(idx + lowerQuery.length, end);
    excerpts.push(`${prefix}${before}>>${match}<<${after}${suffix}`);

    searchFrom = idx + lowerQuery.length;
  }

  return excerpts;
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
    // -------------------------------------------------------------------------
    // Files toolbelt
    // -------------------------------------------------------------------------
    case "readFile": {
      const fileName = String(call.args.filename ?? "").trim();
      if (!fileName) return "[readFile: no filename provided]";

      const entry = ctx.clipboard.find((e) => e.name === fileName);
      if (entry) return entry.content;

      if (ctx.activeDirectoryName) {
        const content = await getFileContent(ctx.activeDirectoryName, fileName);
        if (content instanceof Blob) return `[readFile: "${fileName}" is a binary file]`;
        if (content !== null) return content;
      }
      return `[readFile: file "${fileName}" not found]`;
    }

    case "listFiles": {
      const clipboardSet = new Set(ctx.clipboard.map((e) => e.name));
      const idbNames = ctx.activeDirectoryName
        ? await listFileNamesInDirectory(ctx.activeDirectoryName)
        : [];
      const allNames = [...new Set([...clipboardSet, ...idbNames])];
      if (allNames.length === 0) return "[listFiles: no files found]";
      return allNames
        .map((name) => (clipboardSet.has(name) ? `${name}  [modified]` : name))
        .join("\n");
    }

    case "searchFiles": {
      const query = String(call.args.query ?? "").trim();
      if (!query) return "[searchFiles: no query provided]";
      const lower = query.toLowerCase();
      const clipboardNames = ctx.clipboard.map((e) => e.name);
      const idbNames = ctx.activeDirectoryName
        ? await listFileNamesInDirectory(ctx.activeDirectoryName)
        : [];
      const allNames = [...new Set([...clipboardNames, ...idbNames])];
      const matches = allNames.filter((name) => name.toLowerCase().includes(lower));
      return matches.length > 0
        ? matches.join("\n")
        : `[searchFiles: no files matching "${query}"]`;
    }

    case "searchContent": {
      const query = String(call.args.query ?? "").trim();
      if (!query) return "[searchContent: no query provided]";
      const lowerQuery = query.toLowerCase();
      const results: string[] = [];

      // Search clipboard files (already in memory)
      for (const entry of ctx.clipboard) {
        const content = entry.content;
        if (!content) continue;
        const excerpts = findExcerpts(content, lowerQuery);
        if (excerpts.length > 0) {
          results.push(
            `${entry.name} [modified]:\n${excerpts.map((e) => `  ${e}`).join("\n")}`,
          );
        }
        if (results.length >= 10) break;
      }

      // Search IDB files
      if (ctx.activeDirectoryName && results.length < 10) {
        const names = await listFileNamesInDirectory(ctx.activeDirectoryName);
        for (const name of names) {
          if (results.length >= 10) break;
          // Skip if already found via clipboard
          if (ctx.clipboard.some((e) => e.name === name)) continue;
          const content = await getFileContent(ctx.activeDirectoryName, name);
          if (typeof content !== "string") continue;
          const excerpts = findExcerpts(content, lowerQuery);
          if (excerpts.length > 0) {
            results.push(`${name}:\n${excerpts.map((e) => `  ${e}`).join("\n")}`);
          }
        }
      }

      return results.length > 0
        ? results.join("\n\n")
        : `[searchContent: no matches found for "${query}"]`;
    }

    case "searchByTag": {
      const rawTags = call.args.tags;
      const queryTags: string[] = (
        Array.isArray(rawTags) ? rawTags : [rawTags]
      ).map((t: unknown) =>
        String(t ?? "")
          .toLowerCase()
          .replace(/^#?/, "#"),
      );
      if (queryTags.length === 0 || queryTags[0] === "#") {
        return "[searchByTag: no tags provided]";
      }
      const clipboardNames = ctx.clipboard.map((e) => e.name);
      const idbNames = ctx.activeDirectoryName
        ? await listFileNamesInDirectory(ctx.activeDirectoryName)
        : [];
      const allNames = [...new Set([...clipboardNames, ...idbNames])];
      const matches = allNames.filter((name) => {
        const fileTags = parseFileName(name).tags.map((t) => t.toLowerCase());
        return queryTags.every((tag) => fileTags.includes(tag));
      });
      return matches.length > 0
        ? matches.join("\n")
        : `[searchByTag: no files with tags ${queryTags.join(", ")}]`;
    }

    case "createFile": {
      const name = String(call.args.filename ?? "").trim();
      const content = String(call.args.content ?? "");
      if (!name) return "[createFile: no filename provided]";
      ctx.onCreateClipboardFile(name, content);
      return `[createFile: created "${name}" in clipboard]`;
    }

    case "writeFile": {
      const name = String(call.args.filename ?? "").trim();
      const content = String(call.args.content ?? "");
      if (!name) return "[writeFile: no filename provided]";
      if (!ctx.activeDirectoryName) return "[writeFile: no active directory]";
      await ctx.onWriteFile(name, content);
      return `[writeFile: saved "${name}"]`;
    }

    case "appendToFile": {
      const name = String(call.args.filename ?? "").trim();
      const content = String(call.args.content ?? "");
      if (!name) return "[appendToFile: no filename provided]";
      if (!ctx.activeDirectoryName) return "[appendToFile: no active directory]";
      const existing = await getFileContent(ctx.activeDirectoryName, name);
      if (existing instanceof Blob) return `[appendToFile: "${name}" is a binary file]`;
      await ctx.onWriteFile(name, (existing ?? "") + content);
      return `[appendToFile: appended to "${name}"]`;
    }

    case "deleteFile": {
      const name = String(call.args.filename ?? "").trim();
      if (!name) return "[deleteFile: no filename provided]";
      if (!ctx.activeDirectoryName) return "[deleteFile: no active directory]";
      await ctx.onDeleteFile(name);
      return `[deleteFile: deleted "${name}"]`;
    }

    case "renameFile": {
      const oldName = String(call.args.old_filename ?? "").trim();
      const newName = String(call.args.new_filename ?? "").trim();
      if (!oldName) return "[renameFile: no old_filename provided]";
      if (!newName) return "[renameFile: no new_filename provided]";
      if (!ctx.activeDirectoryName) return "[renameFile: no active directory]";
      if (oldName === newName) return "[renameFile: old and new names are the same]";
      await ctx.onRenameFile(oldName, newName);
      return `[renameFile: renamed "${oldName}" to "${newName}"]`;
    }

    case "listDirectories": {
      const dirs = await listAllDirectories();
      if (dirs.length === 0) return "[listDirectories: no directories found]";
      return dirs
        .map((d) => (d === ctx.activeDirectoryName ? `${d}  [active]` : d))
        .join("\n");
    }

    case "readFileFromDirectory": {
      const directory = String(call.args.directory ?? "").trim();
      const fileName = String(call.args.filename ?? "").trim();
      if (!directory) return "[readFileFromDirectory: no directory provided]";
      if (!fileName) return "[readFileFromDirectory: no filename provided]";
      const content = await getFileContent(directory, fileName);
      if (content === null)
        return `[readFileFromDirectory: "${fileName}" not found in "${directory}"]`;
      if (content instanceof Blob)
        return `[readFileFromDirectory: "${fileName}" is a binary file]`;
      return content;
    }

    // -------------------------------------------------------------------------
    // Workspace toolbelt
    // -------------------------------------------------------------------------
    case "readWorkspace": {
      if (ctx.viewedFileContent === null || ctx.viewedFileName === null) {
        return "[readWorkspace: no file is currently viewed]";
      }
      return ctx.viewedFileContent;
    }

    case "appendWorkspace": {
      const text = String(call.args.content ?? "");
      if (!ctx.viewedFileName) return "[appendWorkspace: no file is currently viewed]";
      if (!ctx.viewedFileModified)
        return "[appendWorkspace: file is saved — open it for editing first by clicking it in the file list]";
      ctx.onAppendWorkspace(text);
      return `[appendWorkspace: appended to "${ctx.viewedFileName}"]`;
    }

    case "overwriteWorkspace": {
      const content = String(call.args.content ?? "");
      if (!ctx.viewedFileName) return "[overwriteWorkspace: no file is currently viewed]";
      if (!ctx.viewedFileModified)
        return "[overwriteWorkspace: file is saved — open it for editing first by clicking it in the file list]";
      ctx.onOverwriteWorkspace(content);
      return `[overwriteWorkspace: replaced content of "${ctx.viewedFileName}"]`;
    }

    case "replaceInWorkspace": {
      const search = String(call.args.search ?? "");
      const replace = String(call.args.replace ?? "");
      if (!search) return "[replaceInWorkspace: no search string provided]";
      if (!ctx.viewedFileName) return "[replaceInWorkspace: no file is currently viewed]";
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

    case "getWorkspaceInfo": {
      if (!ctx.viewedFileName) return "[getWorkspaceInfo: no file is currently viewed]";
      const content = ctx.viewedFileContent ?? "";
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      const charCount = content.length;
      const parsed = parseFileName(ctx.viewedFileName);
      const tagsStr = parsed.tags.length > 0 ? parsed.tags.join(", ") : "none";
      const statusStr =
        ctx.viewedFileModified === null
          ? "no file"
          : ctx.viewedFileModified
            ? "modified (unsaved)"
            : "saved";
      return [
        `filename: ${ctx.viewedFileName}`,
        `tags: ${tagsStr}`,
        `extension: ${parsed.ext || "none"}`,
        `status: ${statusStr}`,
        `words: ${wordCount}`,
        `characters: ${charCount}`,
      ].join("\n");
    }

    // -------------------------------------------------------------------------
    // Image toolbelt
    // -------------------------------------------------------------------------
    case "generateImage": {
      const prompt = String(call.args.prompt ?? "").trim();
      const filename = String(call.args.filename ?? "").trim();
      if (!prompt) return "[generateImage: no prompt provided]";
      if (!filename) return "[generateImage: no filename provided]";
      if (!ctx.activeDirectoryName) return "[generateImage: no active directory]";

      const cfg = getImageToolbeltConfig(ctx.nodes);
      if (!cfg) return "[generateImage: image toolbelt not configured]";

      const width = cfg.forceResolution || typeof call.args.width !== "number" ? cfg.width : call.args.width;
      const height = cfg.forceResolution || typeof call.args.height !== "number" ? cfg.height : call.args.height;
      const steps = cfg.forceSteps || typeof call.args.steps !== "number" ? cfg.steps : call.args.steps;

      const client = new FluxClient(cfg.url);
      const blob = await client.generateBlob(prompt, randomSeed(), { width, height, steps });

      await ctx.onImageGenerated(filename, blob);
      return `[generateImage: saved "${filename}"]`;
    }

    case "generateImg2img": {
      const prompt = String(call.args.prompt ?? "").trim();
      const baseFilename = String(call.args.base_filename ?? "").trim();
      const outputFilename = String(call.args.output_filename ?? "").trim();
      if (!prompt) return "[generateImg2img: no prompt provided]";
      if (!baseFilename) return "[generateImg2img: no base_filename provided]";
      if (!outputFilename) return "[generateImg2img: no output_filename provided]";
      if (!ctx.activeDirectoryName) return "[generateImg2img: no active directory]";

      const cfg = getImageToolbeltConfig(ctx.nodes);
      if (!cfg) return "[generateImg2img: image toolbelt not configured]";

      // Load base image blob — "@workspace" uses the currently viewed binary file
      let baseBlob: Blob | null = null;
      if (baseFilename === "@workspace") {
        baseBlob = ctx.viewedFileBlob;
        if (!baseBlob) return "[generateImg2img: no image is currently viewed in the workspace]";
      } else {
        const content = await getFileContent(ctx.activeDirectoryName, baseFilename);
        if (content instanceof Blob) {
          baseBlob = content;
        } else if (content !== null) {
          return `[generateImg2img: "${baseFilename}" is not a binary image file]`;
        }
        if (!baseBlob) return `[generateImg2img: "${baseFilename}" not found]`;
      }

      const denoise = typeof call.args.denoise === "number" ? call.args.denoise : 0.75;
      const width = cfg.forceResolution || typeof call.args.width !== "number" ? cfg.width : call.args.width;
      const height = cfg.forceResolution || typeof call.args.height !== "number" ? cfg.height : call.args.height;
      const steps = cfg.forceSteps || typeof call.args.steps !== "number" ? cfg.steps : call.args.steps;

      const client = new FluxClient(cfg.url);
      const blob = await client.generateImg2imgBlob(prompt, baseBlob, randomSeed(), {
        denoise,
        width,
        height,
        steps,
      });

      await ctx.onImageGenerated(outputFilename, blob);
      return `[generateImg2img: saved "${outputFilename}"]`;
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
export function buildNativeToolDefinitions(nodes: MessageNodeConfig[]): NativeTool[] {
  const enabled = enabledTools(nodes);
  const tools: NativeTool[] = [];

  // -------------------------------------------------------------------------
  // Files toolbelt
  // -------------------------------------------------------------------------
  if (enabled.has("readFile")) {
    tools.push({
      type: "function",
      function: {
        name: "readFile",
        description: "Returns the full content of a named file from the active directory or clipboard.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "The name of the file to read." },
          },
          required: ["filename"],
        },
      },
    });
  }

  if (enabled.has("listFiles")) {
    tools.push({
      type: "function",
      function: {
        name: "listFiles",
        description:
          "Returns a list of all readable file names from the active directory and clipboard. Files with unsaved changes are marked [modified].",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (enabled.has("searchFiles")) {
    tools.push({
      type: "function",
      function: {
        name: "searchFiles",
        description:
          "Search for files by name (case-insensitive substring match) in the active directory and clipboard.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The filename substring to search for." },
          },
          required: ["query"],
        },
      },
    });
  }

  if (enabled.has("searchContent")) {
    tools.push({
      type: "function",
      function: {
        name: "searchContent",
        description:
          "Search the text content of all files in the active directory and clipboard for a query string. Returns matching filenames with surrounding excerpts (marked >>match<<).",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The text to search for." },
          },
          required: ["query"],
        },
      },
    });
  }

  if (enabled.has("searchByTag")) {
    tools.push({
      type: "function",
      function: {
        name: "searchByTag",
        description:
          "Find files whose names contain specific hashtag labels (e.g. #draft, #urgent). Files must match ALL provided tags. Tags are part of the filename, e.g. 'notes #draft #project'.",
        parameters: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
              description:
                'Array of tags to filter by, e.g. ["#draft", "#project"]. The # prefix is optional.',
            },
          },
          required: ["tags"],
        },
      },
    });
  }

  if (enabled.has("createFile")) {
    tools.push({
      type: "function",
      function: {
        name: "createFile",
        description: "Creates a new file in the clipboard with the given name and text content.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name for the new file." },
            content: { type: "string", description: "Text content for the file." },
          },
          required: ["filename", "content"],
        },
      },
    });
  }

  if (enabled.has("writeFile")) {
    tools.push({
      type: "function",
      function: {
        name: "writeFile",
        description: "Writes (creates or overwrites) a text file in the active directory.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to write." },
            content: { type: "string", description: "Text content to write." },
          },
          required: ["filename", "content"],
        },
      },
    });
  }

  if (enabled.has("appendToFile")) {
    tools.push({
      type: "function",
      function: {
        name: "appendToFile",
        description:
          "Appends text to the end of an existing file in the active directory without overwriting it. Creates the file if it does not exist.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to append to." },
            content: { type: "string", description: "Text to append." },
          },
          required: ["filename", "content"],
        },
      },
    });
  }

  if (enabled.has("deleteFile")) {
    tools.push({
      type: "function",
      function: {
        name: "deleteFile",
        description: "Permanently deletes a file from the active directory.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Name of the file to delete." },
          },
          required: ["filename"],
        },
      },
    });
  }

  if (enabled.has("renameFile")) {
    tools.push({
      type: "function",
      function: {
        name: "renameFile",
        description:
          "Renames a file in the active directory. Can also be used to add or remove hashtag labels in the filename (e.g. rename 'notes.txt' to 'notes #reviewed.txt').",
        parameters: {
          type: "object",
          properties: {
            old_filename: { type: "string", description: "Current name of the file." },
            new_filename: { type: "string", description: "New name for the file." },
          },
          required: ["old_filename", "new_filename"],
        },
      },
    });
  }

  if (enabled.has("listDirectories")) {
    tools.push({
      type: "function",
      function: {
        name: "listDirectories",
        description:
          "Lists all available storage directories. The currently active directory is marked [active].",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  if (enabled.has("readFileFromDirectory")) {
    tools.push({
      type: "function",
      function: {
        name: "readFileFromDirectory",
        description:
          "Reads a file from a specific named directory (not just the active one). Use listDirectories first to discover available directories.",
        parameters: {
          type: "object",
          properties: {
            directory: { type: "string", description: "Name of the directory." },
            filename: { type: "string", description: "Name of the file to read." },
          },
          required: ["directory", "filename"],
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Workspace toolbelt
  // -------------------------------------------------------------------------
  if (enabled.has("readWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "readWorkspace",
        description: "Returns the full content of the currently viewed (active) file.",
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
            content: { type: "string", description: "The new full content for the file." },
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
            search: { type: "string", description: "The exact string to find." },
            replace: { type: "string", description: "The string to replace it with." },
          },
          required: ["search", "replace"],
        },
      },
    });
  }

  if (enabled.has("getWorkspaceInfo")) {
    tools.push({
      type: "function",
      function: {
        name: "getWorkspaceInfo",
        description:
          "Returns metadata about the currently viewed file: name, tags, extension, save status, word count, and character count.",
        parameters: { type: "object", properties: {} },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Image toolbelt
  // -------------------------------------------------------------------------
  if (enabled.has("generateImage")) {
    tools.push({
      type: "function",
      function: {
        name: "generateImage",
        description:
          "Generate an image from a text prompt using ComfyUI (Flux) and save it to the active directory.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text prompt describing the image." },
            filename: { type: "string", description: 'Output filename, e.g. "result.png".' },
            width: {
              type: "number",
              description: "Image width in pixels (uses node default if omitted).",
            },
            height: {
              type: "number",
              description: "Image height in pixels (uses node default if omitted).",
            },
            steps: {
              type: "number",
              description: "Sampling steps (uses node default if omitted).",
            },
          },
          required: ["prompt", "filename"],
        },
      },
    });
  }

  if (enabled.has("generateImg2img")) {
    tools.push({
      type: "function",
      function: {
        name: "generateImg2img",
        description:
          "Generate a new image based on an existing image and a text prompt using ComfyUI (Flux img2img). The base image must be a binary file in the active directory.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text prompt guiding the generation." },
            base_filename: {
              type: "string",
              description: 'Filename of the existing image to use as input, or "@workspace" to use the image currently viewed in the workspace.',
            },
            output_filename: {
              type: "string",
              description: "Filename to save the output image as.",
            },
            denoise: {
              type: "number",
              description:
                "Denoising strength 0–1 (default: 0.75). Lower = closer to original.",
            },
            width: {
              type: "number",
              description: "Output width in pixels (uses node default if omitted).",
            },
            height: {
              type: "number",
              description: "Output height in pixels (uses node default if omitted).",
            },
            steps: {
              type: "number",
              description: "Sampling steps (uses node default if omitted).",
            },
          },
          required: ["prompt", "base_filename", "output_filename"],
        },
      },
    });
  }

  return tools;
}
