/**
 * ComfyUI Flux API — self-contained module.
 *
 * Two usage levels:
 *
 * ## Low-level (full control)
 * ```ts
 * const api = new ComfyApi("http://127.0.0.1:8188");
 * const promptId = await api.queuePrompt(
 *   buildFlux({ ...DEFAULT_FLUX_SETTINGS, prompt: "a cat", seed: randomSeed() })
 * );
 * const imageUrl = await api.getImageUrl(promptId);
 * ```
 *
 * ## High-level (stateful FluxClient)
 * ```ts
 * const client = new FluxClient("http://127.0.0.1:8188", { steps: 10, width: 1024, height: 1024 });
 * const blob = await client.generateBlob("a cat", randomSeed());
 * ```
 */

// ---------------------------------------------------------------------------
// Graph builder DSL
// ---------------------------------------------------------------------------

type ScalarInput = string | number | boolean;
type LinkInput = [nodeId: string, slot: number];
type InputValue = ScalarInput | LinkInput;

interface NodeDef {
  class_type: string;
  inputs: Record<string, InputValue>;
}

/** A reference to one output slot of a node — passed to `.link()` on another node. */
export interface NodeOutput {
  readonly nodeId: string;
  readonly slot: number;
}

/** Fluent builder for a single node. Returned by `GraphBuilder.node()`. */
export class NodeBuilder {
  constructor(
    private readonly nodes: Map<string, NodeDef>,
    private readonly id: string,
  ) {}

  /** Set a constant scalar input (string, number, boolean). */
  input(name: string, value: ScalarInput): this {
    this.nodes.get(this.id)!.inputs[name] = value;
    return this;
  }

  /** Connect an input to another node's output slot (creates a link). */
  link(name: string, output: NodeOutput): this {
    this.nodes.get(this.id)!.inputs[name] = [output.nodeId, output.slot];
    return this;
  }

  /**
   * Finish building this node and return handles to its output slots.
   * `count` must match the number of outputs the ComfyUI node type produces.
   */
  outputs(count: number): NodeOutput[] {
    const { id } = this;
    return Array.from({ length: count }, (_, slot) => ({ nodeId: id, slot }));
  }
}

/** Programmatic workflow graph builder. */
export class GraphBuilder {
  private readonly nodes = new Map<string, NodeDef>();

  /** Add a new node to the graph and return its builder. */
  node(id: string, classType: string): NodeBuilder {
    this.nodes.set(id, { class_type: classType, inputs: {} });
    return new NodeBuilder(this.nodes, id);
  }

  /** Produce the JSON object ComfyUI's `/prompt` endpoint expects. */
  finalize(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [id, node] of this.nodes) {
      result[id] = {
        class_type: node.class_type,
        inputs: { ...node.inputs },
      };
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// HTTP / WebSocket client (ComfyApi)
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

interface PromptResponse {
  prompt_id: string;
}

interface HistoryOutputNode {
  images?: ImageInfo[];
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutputNode>;
}

export class ComfyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ComfyApiError";
  }
}

/** Stateless HTTP/WS client for the ComfyUI server. */
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

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Submit a workflow to the queue.
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

  /**
   * Upload an image to ComfyUI's input folder.
   * @returns the filename ComfyUI stored it under — pass to `buildFluxImg2img`.
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

  async getHistory(promptId: string): Promise<HistoryEntry> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`);
    if (!res.ok) {
      throw new ComfyApiError(`Failed to fetch history (HTTP ${res.status})`);
    }
    const data = (await res.json()) as Record<string, HistoryEntry>;
    const entry = data[promptId];
    if (!entry) throw new ComfyApiError(`No history entry for prompt ${promptId}`);
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
          throw new ComfyApiError(`Failed to download image (HTTP ${res.status})`);
        }
        return res.blob();
      }
    }
    throw new ComfyApiError("No images found in prompt output");
  }

  async getImageUrl(promptId: string): Promise<string> {
    const blob = await this.getImage(promptId);
    return URL.createObjectURL(blob);
  }

  /**
   * List available model filenames from a ComfyUI model folder.
   * @param folder - e.g. "diffusion_models" for FLUX, "checkpoints" for SDXL
   */
  async listModels(folder: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models/${folder}`);
    if (!res.ok) {
      throw new ComfyApiError(`Failed to list models (HTTP ${res.status})`);
    }
    return res.json() as Promise<string[]>;
  }

  /**
   * Open a WebSocket connection and forward ComfyUI progress messages to `onMessage`.
   * Returns a cleanup function.
   */
  listenProgress(onMessage: (msg: ComfyMessage) => void): () => void {
    const ws = new WebSocket(`${this.wsUrl}?clientId=${this.clientId}`);
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

function parseWsMessage(json: unknown): ComfyMessage | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;
  switch (j["type"]) {
    case "progress": {
      const data = j["data"] as Record<string, number>;
      return {
        type: "progress",
        progress: { currentStep: data["value"] ?? 0, totalSteps: data["max"] ?? 0 },
      };
    }
    case "executing": {
      const data = j["data"] as Record<string, unknown>;
      return data["node"] === null ? { type: "executionComplete" } : { type: "executing" };
    }
    case "execution_error": {
      const data = j["data"] as Record<string, unknown>;
      return { type: "error", message: (data["exception_message"] as string) ?? "Unknown error" };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Flux workflow builders
// ---------------------------------------------------------------------------

export interface FluxSamplerSettings {
  /** UNET model filename, e.g. "flux1_v10Fp8Schnell.safetensors" */
  model: string;
  steps: number;
  /** Guidance scale (FluxGuidance node) */
  cfg: number;
  samplerName: string;
  scheduler: string;
  /** 1.0 for txt2img; lower for img2img strength */
  denoise: number;
  width: number;
  height: number;
}

export const DEFAULT_FLUX_SETTINGS: FluxSamplerSettings = {
  model: "flux1_v10Fp8Schnell.safetensors",
  steps: 7,
  cfg: 3.5,
  samplerName: "euler",
  scheduler: "simple",
  denoise: 1.0,
  width: 768,
  height: 768,
};

export interface FluxWorkflowParams extends FluxSamplerSettings {
  prompt: string;
  seed: number;
}

/** Standard FLUX txt2img workflow. */
export function buildFlux(params: FluxWorkflowParams): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g.node("48", "UNETLoader")
    .input("unet_name", params.model).input("weight_dtype", "default").outputs(1);

  const clip = g.node("11", "DualCLIPLoader")
    .input("clip_name1", "t5xxl_fp8_e4m3fn.safetensors")
    .input("clip_name2", "clip-vit-large-patch14/text_encoder/model.safetensors")
    .input("type", "flux").input("device", "default").outputs(1);

  const vae = g.node("10", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors").outputs(1);

  const model = g.node("46", "ModelSamplingFlux")
    .input("max_shift", 1.15).input("base_shift", 0.5)
    .input("width", params.width).input("height", params.height)
    .link("model", unet[0]).outputs(1);

  const encoded = g.node("43", "CLIPTextEncode")
    .input("text", params.prompt).link("clip", clip[0]).outputs(1);

  const guided = g.node("42", "FluxGuidance")
    .input("guidance", params.cfg).link("conditioning", encoded[0]).outputs(1);

  const latent = g.node("44", "EmptySD3LatentImage")
    .input("width", params.width).input("height", params.height)
    .input("batch_size", 1).outputs(1);

  const noise = g.node("45", "RandomNoise")
    .input("noise_seed", params.seed).outputs(1);

  const sampler = g.node("47", "KSamplerSelect")
    .input("sampler_name", params.samplerName).outputs(1);

  const sigmas = g.node("17", "BasicScheduler")
    .input("scheduler", params.scheduler).input("steps", params.steps)
    .input("denoise", params.denoise).link("model", model[0]).outputs(1);

  const guider = g.node("38", "BasicGuider")
    .link("model", model[0]).link("conditioning", guided[0]).outputs(1);

  const sampled = g.node("40", "SamplerCustomAdvanced")
    .link("noise", noise[0]).link("guider", guider[0])
    .link("sampler", sampler[0]).link("sigmas", sigmas[0])
    .link("latent_image", latent[0]).outputs(2);

  const decoded = g.node("8", "VAEDecode")
    .link("samples", sampled[1]).link("vae", vae[0]).outputs(1);

  g.node("57", "SaveImage").input("filename_prefix", "ComfyUI").link("images", decoded[0]).outputs(0);

  return g.finalize();
}

/** FLUX latent-loopback workflow (requires LoopStart/LoopEnd custom nodes). */
export function buildFluxLoop(params: FluxWorkflowParams): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g.node("48", "UNETLoader")
    .input("unet_name", params.model).input("weight_dtype", "default").outputs(1);

  const clip = g.node("11", "DualCLIPLoader")
    .input("clip_name1", "t5xxl_fp8_e4m3fn.safetensors")
    .input("clip_name2", "clip-vit-large-patch14/text_encoder/model.safetensors")
    .input("type", "flux").input("device", "default").outputs(1);

  const vae = g.node("10", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors").outputs(1);

  const model = g.node("46", "ModelSamplingFlux")
    .input("max_shift", 1.15).input("base_shift", 0.5)
    .input("width", params.width).input("height", params.height)
    .link("model", unet[0]).outputs(1);

  const encoded = g.node("43", "CLIPTextEncode")
    .input("text", params.prompt).link("clip", clip[0]).outputs(1);

  const guided = g.node("42", "FluxGuidance")
    .input("guidance", params.cfg).link("conditioning", encoded[0]).outputs(1);

  const emptyLatent = g.node("44", "EmptySD3LatentImage")
    .input("width", params.width).input("height", params.height)
    .input("batch_size", 1).outputs(1);

  const loopToken = g.node("58", "Loop").outputs(1);

  const loopStart = g.node("59", "LoopStart_LATENT")
    .input("reset", false)
    .link("first_loop", emptyLatent[0]).link("loop", loopToken[0]).outputs(1);

  const noise = g.node("45", "RandomNoise")
    .input("noise_seed", params.seed).outputs(1);

  const sampler = g.node("47", "KSamplerSelect")
    .input("sampler_name", params.samplerName).outputs(1);

  const sigmas = g.node("17", "BasicScheduler")
    .input("scheduler", params.scheduler).input("steps", params.steps)
    .input("denoise", params.denoise).link("model", model[0]).outputs(1);

  const guider = g.node("38", "BasicGuider")
    .link("model", model[0]).link("conditioning", guided[0]).outputs(1);

  const sampled = g.node("40", "SamplerCustomAdvanced")
    .link("noise", noise[0]).link("guider", guider[0])
    .link("sampler", sampler[0]).link("sigmas", sigmas[0])
    .link("latent_image", loopStart[0]).outputs(2);

  const decoded = g.node("8", "VAEDecode")
    .link("samples", sampled[1]).link("vae", vae[0]).outputs(1);

  g.node("56", "PreviewImage").link("images", decoded[0]).outputs(0);
  g.node("60", "LoopEnd_LATENT")
    .link("send_to_next_loop", sampled[0]).link("loop", loopToken[0]).outputs(0);

  return g.finalize();
}

/**
 * FLUX img2img workflow — encodes an input image as the starting latent.
 * @param inputImageFilename - filename as stored in ComfyUI's input folder (from `ComfyApi.uploadImage`)
 */
export function buildFluxImg2img(
  params: FluxWorkflowParams,
  inputImageFilename: string,
): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g.node("26", "UNETLoader")
    .input("unet_name", params.model).input("weight_dtype", "default").outputs(1);

  const clip = g.node("19", "DualCLIPLoaderGGUF")
    .input("clip_name1", "clip_l.safetensors")
    .input("clip_name2", "flux_gguf\\t5-v1_1-xxl-encoder-Q8_0.gguf")
    .input("type", "flux").outputs(1);

  const vae = g.node("11", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors").outputs(1);

  const loadedImage = g.node("21", "LoadImage")
    .input("image", inputImageFilename).outputs(2);

  const latent = g.node("23", "VAEEncode")
    .link("pixels", loadedImage[0]).link("vae", vae[0]).outputs(1);

  const positive = g.node("15", "CLIPTextEncodeFlux")
    .input("clip_l", params.prompt).input("t5xxl", params.prompt)
    .input("guidance", params.cfg).link("clip", clip[0]).outputs(1);

  const negative = g.node("16", "ConditioningZeroOut")
    .link("conditioning", positive[0]).outputs(1);

  const sampled = g.node("3", "KSampler")
    .input("seed", params.seed).input("steps", params.steps)
    .input("cfg", params.cfg).input("sampler_name", params.samplerName)
    .input("scheduler", params.scheduler).input("denoise", params.denoise)
    .link("model", unet[0]).link("positive", positive[0])
    .link("negative", negative[0]).link("latent_image", latent[0]).outputs(1);

  const decoded = g.node("8", "VAEDecode")
    .link("samples", sampled[0]).link("vae", vae[0]).outputs(1);

  g.node("17", "PreviewImage").link("images", decoded[0]).outputs(0);

  return g.finalize();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Generate a random seed suitable for ComfyUI's noise_seed / seed inputs. */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

// ---------------------------------------------------------------------------
// FluxClient — high-level stateful client
// ---------------------------------------------------------------------------

export type FluxMode = "standard" | "loop" | "img2img";

export class FluxClient {
  private readonly api: ComfyApi;

  /** Mutable settings — change between calls or bind to a SolidJS store. */
  settings: FluxSamplerSettings;

  constructor(baseUrl = "http://127.0.0.1:8188", settings?: Partial<FluxSamplerSettings>) {
    this.api = new ComfyApi(baseUrl);
    this.settings = { ...DEFAULT_FLUX_SETTINGS, ...settings };
  }

  get clientId(): string { return this.api.clientId; }

  checkConnection(): Promise<boolean> { return this.api.checkConnection(); }

  listModels(): Promise<string[]> { return this.api.listModels("diffusion_models"); }

  async generate(
    prompt: string,
    mode: Exclude<FluxMode, "img2img"> = "standard",
    seed = randomSeed(),
  ): Promise<string> {
    const params: FluxWorkflowParams = { ...this.settings, prompt, seed };
    const workflow = mode === "loop" ? buildFluxLoop(params) : buildFlux(params);
    return this.api.queuePrompt(workflow);
  }

  async generateImg2Img(
    prompt: string,
    inputImageFilename: string,
    seed = randomSeed(),
  ): Promise<string> {
    const params: FluxWorkflowParams = { ...this.settings, prompt, seed };
    return this.api.queuePrompt(buildFluxImg2img(params, inputImageFilename));
  }

  uploadImage(file: File | Blob, filename?: string): Promise<string> {
    return this.api.uploadImage(file, filename);
  }

  getImageUrl(promptId: string): Promise<string> { return this.api.getImageUrl(promptId); }

  listenProgress(onMessage: (msg: ComfyMessage) => void): () => void {
    return this.api.listenProgress(onMessage);
  }

  async generateBlob(
    prompt: string,
    seed?: number,
    overrides?: Partial<FluxSamplerSettings>,
  ): Promise<Blob> {
    const savedSettings = this.settings;
    if (overrides) this.settings = { ...this.settings, ...overrides };
    let promptId: string;
    try {
      promptId = await this.generate(prompt, "standard", seed);
    } finally {
      this.settings = savedSettings;
    }
    return this._waitForBlob(promptId);
  }

  async generateImg2imgBlob(
    prompt: string,
    inputBlob: Blob,
    seed?: number,
    overrides?: Partial<FluxSamplerSettings>,
  ): Promise<Blob> {
    const uploadedFilename = await this.api.uploadImage(inputBlob);
    const savedSettings = this.settings;
    if (overrides) this.settings = { ...this.settings, ...overrides };
    let promptId: string;
    try {
      promptId = await this.generateImg2Img(prompt, uploadedFilename, seed);
    } finally {
      this.settings = savedSettings;
    }
    return this._waitForBlob(promptId);
  }

  private _waitForBlob(promptId: string): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const cleanup = this.api.listenProgress((msg) => {
        if (msg.type === "executionComplete") {
          cleanup();
          this.api.getImage(promptId).then(resolve).catch(reject);
        } else if (msg.type === "error") {
          cleanup();
          reject(new Error(`ComfyUI error: ${msg.message}`));
        }
      });
    });
  }
}
