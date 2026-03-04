/**
 * ComfyApi — stateless HTTP/WS client for the ComfyUI server.
 *
 * Accepts pre-built workflow JSON (from the workflow builders) rather than
 * managing workflow state itself. All browser APIs only (fetch, WebSocket,
 * FormData, URL.createObjectURL) — no Node.js dependencies.
 */

// ---------------------------------------------------------------------------
// Progress / message types
// ---------------------------------------------------------------------------

export interface Progress {
  currentStep: number;
  totalSteps: number;
}

export type ComfyMessage =
  | { type: "progress"; progress: Progress }
  | { type: "executing" }
  | { type: "executionComplete" }
  | { type: "error"; message: string };

export interface ImageInfo {
  filename: string;
  subfolder: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Internal response shapes
// ---------------------------------------------------------------------------

interface PromptResponse {
  prompt_id: string;
}

interface HistoryOutputNode {
  images?: ImageInfo[];
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutputNode>;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ComfyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ComfyApiError";
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ComfyApi {
  /** UUID identifying this client session — used for WebSocket routing. */
  readonly clientId: string;

  private readonly baseUrl: string;
  private readonly wsUrl: string;

  constructor(baseUrl = "http://127.0.0.1:8188") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wsUrl =
      this.baseUrl.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws";
    this.clientId = crypto.randomUUID();
  }

  // ---- Connection ----------------------------------------------------------

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---- Prompts -------------------------------------------------------------

  /**
   * Submit a workflow to the queue.
   * @param workflow - pre-built workflow JSON from `buildFlux` etc.
   * @returns the prompt_id to poll / listen for
   */
  async queuePrompt(workflow: Record<string, unknown>): Promise<string> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
    });
    if (!res.ok) {
      throw new ComfyApiError(
        `ComfyUI prompt failed: ${await res.text()}`,
        res.status,
      );
    }
    const data = (await res.json()) as PromptResponse;
    return data.prompt_id;
  }

  // ---- Image I/O -----------------------------------------------------------

  /**
   * Upload an image to ComfyUI's input folder.
   * @returns the filename ComfyUI stored it under (may differ from the original
   *   to avoid collisions) — pass this to `buildFluxImg2img` as `inputImageFilename`.
   */
  async uploadImage(file: File | Blob, filename?: string): Promise<string> {
    const name = filename ?? (file instanceof File ? file.name : "upload.png");
    const form = new FormData();
    form.append("image", file, name);

    const res = await fetch(`${this.baseUrl}/upload/image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new ComfyApiError(
        `Failed to upload image (HTTP ${res.status}): ${await res.text()}`,
        res.status,
      );
    }
    const data = (await res.json()) as { name: string };
    return data.name;
  }

  /** Fetch history entry for a completed prompt. */
  async getHistory(promptId: string): Promise<HistoryEntry> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) {
      throw new ComfyApiError(
        `Failed to fetch history (HTTP ${res.status})`,
        res.status,
      );
    }
    const data = (await res.json()) as Record<string, HistoryEntry>;
    const entry = data[promptId];
    if (!entry) {
      throw new ComfyApiError(`No history entry for prompt ${promptId}`);
    }
    return entry;
  }

  /** Download the first output image for a completed prompt as a Blob. */
  async getImage(promptId: string): Promise<Blob> {
    const history = await this.getHistory(promptId);

    for (const output of Object.values(history.outputs)) {
      const image = output.images?.[0];
      if (image) {
        const url =
          `${this.baseUrl}/view` +
          `?filename=${encodeURIComponent(image.filename)}` +
          `&subfolder=${encodeURIComponent(image.subfolder)}` +
          `&type=${encodeURIComponent(image.type)}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new ComfyApiError(
            `Failed to download image (HTTP ${res.status})`,
            res.status,
          );
        }
        return res.blob();
      }
    }
    throw new ComfyApiError("No images found in prompt output");
  }

  /**
   * Download the first output image and return an object URL suitable for
   * use in an `<img src>`. Remember to call `URL.revokeObjectURL` when done.
   */
  async getImageUrl(promptId: string): Promise<string> {
    const blob = await this.getImage(promptId);
    return URL.createObjectURL(blob);
  }

  // ---- Models --------------------------------------------------------------

  /**
   * List available model filenames from a ComfyUI model folder.
   * @param folder - e.g. "diffusion_models" for FLUX, "checkpoints" for SDXL
   */
  async listModels(folder: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models/${folder}`);
    if (!res.ok) {
      throw new ComfyApiError(
        `Failed to list models (HTTP ${res.status})`,
        res.status,
      );
    }
    return res.json() as Promise<string[]>;
  }

  // ---- WebSocket progress --------------------------------------------------

  /**
   * Open a WebSocket connection and forward ComfyUI progress messages to `onMessage`.
   * Returns a cleanup function — pass it to `onCleanup` in SolidJS.
   *
   * @example
   * // SolidJS:
   * const [progress, setProgress] = createSignal<Progress | null>(null);
   * const [done, setDone] = createSignal(false);
   *
   * onMount(() => {
   *   const cleanup = api.listenProgress((msg) => {
   *     if (msg.type === "progress") setProgress(msg.progress);
   *     if (msg.type === "executionComplete") setDone(true);
   *   });
   *   onCleanup(cleanup);
   * });
   */
  listenProgress(onMessage: (msg: ComfyMessage) => void): () => void {
    const ws = new WebSocket(
      `${this.wsUrl}?clientId=${this.clientId}`,
    );

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      try {
        const msg = parseWsMessage(JSON.parse(event.data) as unknown);
        if (msg) onMessage(msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.addEventListener("error", () => {
      onMessage({ type: "error", message: "WebSocket connection error" });
    });

    return () => ws.close();
  }
}

// ---------------------------------------------------------------------------
// Internal — WebSocket message parsing
// ---------------------------------------------------------------------------

function parseWsMessage(json: unknown): ComfyMessage | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;

  switch (j["type"]) {
    case "progress": {
      const data = j["data"] as Record<string, number>;
      return {
        type: "progress",
        progress: {
          currentStep: data["value"] ?? 0,
          totalSteps: data["max"] ?? 0,
        },
      };
    }
    case "executing": {
      const data = j["data"] as Record<string, unknown>;
      // ComfyUI signals execution complete by sending "executing" with node: null
      return data["node"] === null
        ? { type: "executionComplete" }
        : { type: "executing" };
    }
    case "execution_error": {
      const data = j["data"] as Record<string, unknown>;
      return {
        type: "error",
        message: (data["exception_message"] as string) ?? "Unknown error",
      };
    }
    default:
      return null;
  }
}
