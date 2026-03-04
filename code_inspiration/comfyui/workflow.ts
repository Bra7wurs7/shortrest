/**
 * Flux workflow builders.
 *
 * Three variants mirror the Rust implementation exactly:
 *   buildFlux        — standard txt2img
 *   buildFluxLoop    — latent loopback (requires LoopStart/LoopEnd custom nodes)
 *   buildFluxImg2img — img2img via VAEEncode (uses DualCLIPLoaderGGUF + KSampler)
 *
 * All return a plain object ready to pass to `ComfyApi.queuePrompt()`.
 */

import { GraphBuilder } from "./graph.js";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Standard FLUX txt2img workflow.
 *
 * Nodes:
 *   48  UNETLoader              → MODEL(0)
 *   11  DualCLIPLoader          → CLIP(0)
 *   10  VAELoader               → VAE(0)
 *   46  ModelSamplingFlux       → MODEL(0)
 *   43  CLIPTextEncode          → CONDITIONING(0)
 *   42  FluxGuidance            → CONDITIONING(0)
 *   44  EmptySD3LatentImage     → LATENT(0)
 *   45  RandomNoise             → NOISE(0)
 *   47  KSamplerSelect          → SAMPLER(0)
 *   17  BasicScheduler          → SIGMAS(0)
 *   38  BasicGuider             → GUIDER(0)
 *   40  SamplerCustomAdvanced   → OUTPUT(0), LATENT(1)
 *    8  VAEDecode               → IMAGE(0)
 *   57  SaveImage
 */
export function buildFlux(params: FluxWorkflowParams): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g
    .node("48", "UNETLoader")
    .input("unet_name", params.model)
    .input("weight_dtype", "default")
    .outputs(1); // MODEL

  const clip = g
    .node("11", "DualCLIPLoader")
    .input("clip_name1", "t5xxl_fp8_e4m3fn.safetensors")
    .input("clip_name2", "clip-vit-large-patch14/text_encoder/model.safetensors")
    .input("type", "flux")
    .input("device", "default")
    .outputs(1); // CLIP

  const vae = g
    .node("10", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors")
    .outputs(1); // VAE

  const model = g
    .node("46", "ModelSamplingFlux")
    .input("max_shift", 1.15)
    .input("base_shift", 0.5)
    .input("width", params.width)
    .input("height", params.height)
    .link("model", unet[0])
    .outputs(1); // MODEL

  const encoded = g
    .node("43", "CLIPTextEncode")
    .input("text", params.prompt)
    .link("clip", clip[0])
    .outputs(1); // CONDITIONING

  const guided = g
    .node("42", "FluxGuidance")
    .input("guidance", params.cfg)
    .link("conditioning", encoded[0])
    .outputs(1); // CONDITIONING

  const latent = g
    .node("44", "EmptySD3LatentImage")
    .input("width", params.width)
    .input("height", params.height)
    .input("batch_size", 1)
    .outputs(1); // LATENT

  const noise = g
    .node("45", "RandomNoise")
    .input("noise_seed", params.seed)
    .outputs(1); // NOISE

  const sampler = g
    .node("47", "KSamplerSelect")
    .input("sampler_name", params.samplerName)
    .outputs(1); // SAMPLER

  const sigmas = g
    .node("17", "BasicScheduler")
    .input("scheduler", params.scheduler)
    .input("steps", params.steps)
    .input("denoise", params.denoise)
    .link("model", model[0])
    .outputs(1); // SIGMAS

  const guider = g
    .node("38", "BasicGuider")
    .link("model", model[0])
    .link("conditioning", guided[0])
    .outputs(1); // GUIDER

  const sampled = g
    .node("40", "SamplerCustomAdvanced")
    .link("noise", noise[0])
    .link("guider", guider[0])
    .link("sampler", sampler[0])
    .link("sigmas", sigmas[0])
    .link("latent_image", latent[0])
    .outputs(2); // OUTPUT(0), LATENT(1)

  const decoded = g
    .node("8", "VAEDecode")
    .link("samples", sampled[1])
    .link("vae", vae[0])
    .outputs(1); // IMAGE

  g.node("57", "SaveImage")
    .input("filename_prefix", "ComfyUI")
    .link("images", decoded[0])
    .outputs(0);

  return g.finalize();
}

/**
 * FLUX latent-loopback workflow.
 *
 * Requires the LoopStart_LATENT / LoopEnd_LATENT / Loop custom nodes.
 * On the first run LoopStart_LATENT falls back to an empty latent;
 * on subsequent runs it reuses the previous generation's latent.
 *
 * Extra nodes vs. standard Flux:
 *   58  Loop              → LOOP(0)
 *   59  LoopStart_LATENT  → LATENT(0)
 *   56  PreviewImage      (output — replaces SaveImage)
 *   60  LoopEnd_LATENT    (stores latent for next run)
 */
export function buildFluxLoop(params: FluxWorkflowParams): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g
    .node("48", "UNETLoader")
    .input("unet_name", params.model)
    .input("weight_dtype", "default")
    .outputs(1);

  const clip = g
    .node("11", "DualCLIPLoader")
    .input("clip_name1", "t5xxl_fp8_e4m3fn.safetensors")
    .input("clip_name2", "clip-vit-large-patch14/text_encoder/model.safetensors")
    .input("type", "flux")
    .input("device", "default")
    .outputs(1);

  const vae = g
    .node("10", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors")
    .outputs(1);

  const model = g
    .node("46", "ModelSamplingFlux")
    .input("max_shift", 1.15)
    .input("base_shift", 0.5)
    .input("width", params.width)
    .input("height", params.height)
    .link("model", unet[0])
    .outputs(1);

  const encoded = g
    .node("43", "CLIPTextEncode")
    .input("text", params.prompt)
    .link("clip", clip[0])
    .outputs(1);

  const guided = g
    .node("42", "FluxGuidance")
    .input("guidance", params.cfg)
    .link("conditioning", encoded[0])
    .outputs(1);

  // Empty latent used as first_loop fallback by LoopStart_LATENT
  const emptyLatent = g
    .node("44", "EmptySD3LatentImage")
    .input("width", params.width)
    .input("height", params.height)
    .input("batch_size", 1)
    .outputs(1);

  // Stateful loop token — carries the latent across executions
  const loopToken = g.node("58", "Loop").outputs(1);

  // Selects empty latent on first run, previous latent on subsequent runs
  const loopStart = g
    .node("59", "LoopStart_LATENT")
    .input("reset", false)
    .link("first_loop", emptyLatent[0])
    .link("loop", loopToken[0])
    .outputs(1);

  const noise = g
    .node("45", "RandomNoise")
    .input("noise_seed", params.seed)
    .outputs(1);

  const sampler = g
    .node("47", "KSamplerSelect")
    .input("sampler_name", params.samplerName)
    .outputs(1);

  const sigmas = g
    .node("17", "BasicScheduler")
    .input("scheduler", params.scheduler)
    .input("steps", params.steps)
    .input("denoise", params.denoise)
    .link("model", model[0])
    .outputs(1);

  const guider = g
    .node("38", "BasicGuider")
    .link("model", model[0])
    .link("conditioning", guided[0])
    .outputs(1);

  const sampled = g
    .node("40", "SamplerCustomAdvanced")
    .link("noise", noise[0])
    .link("guider", guider[0])
    .link("sampler", sampler[0])
    .link("sigmas", sigmas[0])
    .link("latent_image", loopStart[0]) // feeds from loop, not empty latent directly
    .outputs(2); // OUTPUT(0), LATENT(1)

  const decoded = g
    .node("8", "VAEDecode")
    .link("samples", sampled[1])
    .link("vae", vae[0])
    .outputs(1);

  g.node("56", "PreviewImage").link("images", decoded[0]).outputs(0);

  // Stores sampled latent so LoopStart_LATENT can use it next run
  g.node("60", "LoopEnd_LATENT")
    .link("send_to_next_loop", sampled[0])
    .link("loop", loopToken[0])
    .outputs(0);

  return g.finalize();
}

/**
 * FLUX img2img workflow — encodes an input image as the starting latent.
 *
 * Uses DualCLIPLoaderGGUF and the simpler KSampler (not SamplerCustomAdvanced).
 * Set `denoise` to control img2img strength: 0.9 = strong influence, 0.3 = subtle.
 *
 * Nodes:
 *   26  UNETLoader              → MODEL(0)
 *   19  DualCLIPLoaderGGUF      → CLIP(0)
 *   11  VAELoader               → VAE(0)
 *   21  LoadImage               → IMAGE(0), MASK(1)
 *   23  VAEEncode               → LATENT(0)
 *   15  CLIPTextEncodeFlux      → CONDITIONING(0)  (positive)
 *   16  ConditioningZeroOut     → CONDITIONING(0)  (null negative)
 *    3  KSampler                → LATENT(0)
 *    8  VAEDecode               → IMAGE(0)
 *   17  PreviewImage
 *
 * @param inputImageFilename - filename as stored in ComfyUI's input folder
 *   (returned by `ComfyApi.uploadImage()`)
 */
export function buildFluxImg2img(
  params: FluxWorkflowParams,
  inputImageFilename: string,
): Record<string, unknown> {
  const g = new GraphBuilder();

  const unet = g
    .node("26", "UNETLoader")
    .input("unet_name", params.model)
    .input("weight_dtype", "default")
    .outputs(1);

  // GGUF CLIP loader (different from standard Flux's DualCLIPLoader)
  const clip = g
    .node("19", "DualCLIPLoaderGGUF")
    .input("clip_name1", "clip_l.safetensors")
    .input("clip_name2", "flux_gguf\\t5-v1_1-xxl-encoder-Q8_0.gguf")
    .input("type", "flux")
    .outputs(1);

  const vae = g
    .node("11", "VAELoader")
    .input("vae_name", "FLUX.1-schnell_ae.safetensors")
    .outputs(1);

  const loadedImage = g
    .node("21", "LoadImage")
    .input("image", inputImageFilename)
    .outputs(2); // IMAGE(0), MASK(1)

  // Encode the input image as a starting latent
  const latent = g
    .node("23", "VAEEncode")
    .link("pixels", loadedImage[0])
    .link("vae", vae[0])
    .outputs(1);

  const positive = g
    .node("15", "CLIPTextEncodeFlux")
    .input("clip_l", params.prompt)
    .input("t5xxl", params.prompt)
    .input("guidance", params.cfg)
    .link("clip", clip[0])
    .outputs(1);

  // Null negative conditioning
  const negative = g
    .node("16", "ConditioningZeroOut")
    .link("conditioning", positive[0])
    .outputs(1);

  const sampled = g
    .node("3", "KSampler")
    .input("seed", params.seed)
    .input("steps", params.steps)
    .input("cfg", params.cfg)
    .input("sampler_name", params.samplerName)
    .input("scheduler", params.scheduler)
    .input("denoise", params.denoise)
    .link("model", unet[0])
    .link("positive", positive[0])
    .link("negative", negative[0])
    .link("latent_image", latent[0])
    .outputs(1);

  const decoded = g
    .node("8", "VAEDecode")
    .link("samples", sampled[0])
    .link("vae", vae[0])
    .outputs(1);

  g.node("17", "PreviewImage").link("images", decoded[0]).outputs(0);

  return g.finalize();
}
