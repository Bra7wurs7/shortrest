import { Context } from "./context.model";

export interface RightTool {
  name: string;
  context_prompts: Context[];
  readTokens: string;
  writeTokens: string;
  seed: number;
  temperature: number;
  top_k: number;
  advancedSettings: boolean;
}
