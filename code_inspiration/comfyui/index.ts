/**
 * ComfyUI Flux API
 *
 * Drop this folder into your SolidJS project and import from here.
 *
 * Two usage levels:
 *
 * ## Low-level (full control)
 * Build the workflow JSON yourself and submit it directly:
 *
 * ```ts
 * import { ComfyApi, buildFlux, DEFAULT_FLUX_SETTINGS, randomSeed } from "./comfyui";
 *
 * const api = new ComfyApi("http://127.0.0.1:8188");
 * const promptId = await api.queuePrompt(
 *   buildFlux({ ...DEFAULT_FLUX_SETTINGS, prompt: "a cat", seed: randomSeed() })
 * );
 * const imageUrl = await api.getImageUrl(promptId);
 * ```
 *
 * ## High-level (stateful FluxClient)
 * Manages settings and wraps the low-level calls:
 *
 * ```ts
 * import { FluxClient } from "./comfyui";
 *
 * const client = new FluxClient("http://127.0.0.1:8188", { steps: 10, width: 1024, height: 1024 });
 * const imageUrl = await client.generate("a cat");
 * ```
 *
 * ## SolidJS progress tracking
 * ```tsx
 * const [progress, setProgress] = createSignal<Progress | null>(null);
 * onMount(() => {
 *   onCleanup(client.listenProgress((msg) => {
 *     if (msg.type === "progress") setProgress(msg.progress);
 *   }));
 * });
 * ```
 */

export { GraphBuilder, type NodeOutput } from "./graph.js";

export {
  buildFlux,
  buildFluxLoop,
  buildFluxImg2img,
  DEFAULT_FLUX_SETTINGS,
  type FluxSamplerSettings,
  type FluxWorkflowParams,
} from "./workflow.js";

export {
  ComfyApi,
  ComfyApiError,
  type Progress,
  type ComfyMessage,
  type ImageInfo,
} from "./api.js";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Generate a random seed suitable for ComfyUI's noise_seed / seed inputs.
 * Uses `crypto.getRandomValues` for uniform distribution.
 */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}

// ---------------------------------------------------------------------------
// FluxClient — high-level stateful client
// ---------------------------------------------------------------------------

import {
  buildFlux,
  buildFluxImg2img,
  buildFluxLoop,
  DEFAULT_FLUX_SETTINGS,
  type FluxSamplerSettings,
  type FluxWorkflowParams,
} from "./workflow.js";
import { ComfyApi, type ComfyMessage } from "./api.js";

export type FluxMode = "standard" | "loop" | "img2img";

export class FluxClient {
  private readonly api: ComfyApi;

  /** Mutable settings — change these between calls or bind to a SolidJS store. */
  settings: FluxSamplerSettings;

  constructor(baseUrl = "http://127.0.0.1:8188", settings?: Partial<FluxSamplerSettings>) {
    this.api = new ComfyApi(baseUrl);
    this.settings = { ...DEFAULT_FLUX_SETTINGS, ...settings };
  }

  get clientId(): string {
    return this.api.clientId;
  }

  // ---- Connection ----------------------------------------------------------

  checkConnection(): Promise<boolean> {
    return this.api.checkConnection();
  }

  /** List available FLUX diffusion models (from the diffusion_models folder). */
  listModels(): Promise<string[]> {
    return this.api.listModels("diffusion_models");
  }

  // ---- Generation ----------------------------------------------------------

  /**
   * Queue a txt2img or latent-loop generation.
   * @returns prompt_id — pass to `getImageUrl` once the WebSocket signals completion.
   */
  async generate(
    prompt: string,
    mode: Exclude<FluxMode, "img2img"> = "standard",
    seed = randomSeed(),
  ): Promise<string> {
    const params: FluxWorkflowParams = { ...this.settings, prompt, seed };
    const workflow =
      mode === "loop" ? buildFluxLoop(params) : buildFlux(params);
    return this.api.queuePrompt(workflow);
  }

  /**
   * Queue an img2img generation.
   * Upload the source image first with `uploadImage`, then pass the returned
   * filename here.
   * @returns prompt_id
   */
  async generateImg2Img(
    prompt: string,
    inputImageFilename: string,
    seed = randomSeed(),
  ): Promise<string> {
    const params: FluxWorkflowParams = { ...this.settings, prompt, seed };
    return this.api.queuePrompt(buildFluxImg2img(params, inputImageFilename));
  }

  // ---- Image I/O -----------------------------------------------------------

  /**
   * Upload a File or Blob to ComfyUI's input folder.
   * @returns the filename ComfyUI stored it under — pass to `generateImg2Img`.
   */
  uploadImage(file: File | Blob, filename?: string): Promise<string> {
    return this.api.uploadImage(file, filename);
  }

  /**
   * Download the output image as an object URL.
   * Call `URL.revokeObjectURL(url)` when the image is no longer needed.
   */
  getImageUrl(promptId: string): Promise<string> {
    return this.api.getImageUrl(promptId);
  }

  // ---- Progress ------------------------------------------------------------

  /**
   * Subscribe to WebSocket progress messages.
   * Returns a cleanup function — pass directly to SolidJS `onCleanup`.
   *
   * @example
   * onMount(() => onCleanup(client.listenProgress((msg) => {
   *   if (msg.type === "progress") setProgress(msg.progress);
   *   if (msg.type === "executionComplete") setDone(true);
   *   if (msg.type === "error") setError(msg.message);
   * })));
   */
  listenProgress(onMessage: (msg: ComfyMessage) => void): () => void {
    return this.api.listenProgress(onMessage);
  }
}
