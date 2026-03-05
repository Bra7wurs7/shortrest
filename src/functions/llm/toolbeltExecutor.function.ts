import { MessageNodeConfig } from "../../types/messageNode.interface";
import { ClipboardEntry } from "../../types/clipboardEntry.interface";
import { getFileContent, listFileNamesInDirectory } from "../dbFilesInterface.functions";
import { NativeTool, NativeToolCall } from "../../types/llmProvider.interface";
import { FluxClient, randomSeed } from "../../comfyui/index";

export interface ToolbeltContext {
  /** Nodes from the active pipeline (used to find which tools are enabled) */
  nodes: MessageNodeConfig[];
  /** Clipboard entries for file tools */
  clipboard: ClipboardEntry[];
  /** Active IDB directory for file tools / image generation */
  activeDirectoryName: string | null;
  /** Currently viewed file name (target for writeWorkspace) */
  viewedFileName: string | null;
  /** Content of the currently viewed file (for readWorkspace) */
  viewedFileContent: string | null;
  /** Called when writeWorkspace appends content to the viewed file */
  onWrite: (appended: string) => void;
  /** Called when createFile creates a new clipboard entry */
  onCreateClipboardFile: (name: string, content: string) => void;
  /** Called when writeFile writes text content to the active IDB directory */
  onWriteFile: (name: string, content: string) => Promise<void>;
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
    case "readFile": {
      const fileName = String(call.args.filename ?? "").trim();
      if (!fileName) return "[readFile: no filename provided]";

      const entry = ctx.clipboard.find((e) => e.name() === fileName);
      if (entry) return entry.content();

      if (ctx.activeDirectoryName) {
        const content = await getFileContent(ctx.activeDirectoryName, fileName);
        if (content instanceof Blob) return `[readFile: "${fileName}" is a binary file]`;
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

    case "readWorkspace": {
      if (ctx.viewedFileContent === null || ctx.viewedFileName === null) {
        return "[readWorkspace: no file is currently viewed]";
      }
      return ctx.viewedFileContent;
    }

    case "writeWorkspace": {
      const text = String(call.args.content ?? "");
      if (!ctx.viewedFileName) return "[writeWorkspace: no file is currently viewed]";
      ctx.onWrite(text);
      return `[writeWorkspace: appended to ${ctx.viewedFileName}]`;
    }

    case "generateImage": {
      const prompt = String(call.args.prompt ?? "").trim();
      const filename = String(call.args.filename ?? "").trim();
      if (!prompt) return "[generateImage: no prompt provided]";
      if (!filename) return "[generateImage: no filename provided]";
      if (!ctx.activeDirectoryName) return "[generateImage: no active directory]";

      const cfg = getImageToolbeltConfig(ctx.nodes);
      if (!cfg) return "[generateImage: image toolbelt not configured]";

      const width = typeof call.args.width === "number" ? call.args.width : cfg.width;
      const height = typeof call.args.height === "number" ? call.args.height : cfg.height;
      const steps = typeof call.args.steps === "number" ? call.args.steps : cfg.steps;

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

      // Get base image blob from clipboard or IDB
      const clipEntry = ctx.clipboard.find((e) => e.name() === baseFilename);
      let baseBlob: Blob | null = null;
      if (clipEntry) {
        const raw = clipEntry.content();
        baseBlob = new Blob([raw]);
      } else if (ctx.activeDirectoryName) {
        const content = await getFileContent(ctx.activeDirectoryName, baseFilename);
        if (content instanceof Blob) baseBlob = content;
        else return `[generateImg2img: "${baseFilename}" is not a binary image file]`;
      }
      if (!baseBlob) return `[generateImg2img: "${baseFilename}" not found]`;

      const denoise = typeof call.args.denoise === "number" ? call.args.denoise : 0.75;
      const steps = typeof call.args.steps === "number" ? call.args.steps : cfg.steps;

      const client = new FluxClient(cfg.url);
      const blob = await client.generateImg2imgBlob(prompt, baseBlob, randomSeed(), { denoise, steps });

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
        description: "Returns a list of all readable file names from the active directory and clipboard.",
        parameters: { type: "object", properties: {} },
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

  if (enabled.has("writeWorkspace")) {
    tools.push({
      type: "function",
      function: {
        name: "writeWorkspace",
        description: "Appends text to the end of the currently viewed file.",
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

  if (enabled.has("generateImage")) {
    tools.push({
      type: "function",
      function: {
        name: "generateImage",
        description: "Generate an image from a text prompt using ComfyUI (Flux) and save it to the active directory.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text prompt describing the image." },
            filename: { type: "string", description: "Output filename, e.g. \"result.png\"." },
            width: { type: "number", description: "Image width in pixels (uses node default if omitted)." },
            height: { type: "number", description: "Image height in pixels (uses node default if omitted)." },
            steps: { type: "number", description: "Sampling steps (uses node default if omitted)." },
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
        description: "Generate a new image based on an existing image and a text prompt using ComfyUI (Flux img2img).",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Text prompt guiding the generation." },
            base_filename: { type: "string", description: "Filename of the existing image to use as input." },
            output_filename: { type: "string", description: "Filename to save the output image as." },
            denoise: { type: "number", description: "Denoising strength 0–1 (default: 0.75). Lower = closer to original." },
            steps: { type: "number", description: "Sampling steps (uses node default if omitted)." },
          },
          required: ["prompt", "base_filename", "output_filename"],
        },
      },
    });
  }

  return tools;
}
