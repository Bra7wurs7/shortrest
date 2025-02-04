export interface Context {
  collapsed: boolean;
  visible: boolean;
  type: "static" | "dynamic";
  content: string;
  dynamic_content: string;
  automatic_dynamic: boolean;
  writeTokens: number;
  readTokens: number;
  temperature: number;
  seed: number;
  top_k: number;
}

export const defaultContext: Context = {
  collapsed: false,
  visible: true,
  type: "static",
  content: "",
  dynamic_content: "",
  automatic_dynamic: false,
  writeTokens: 384,
  readTokens: 384,
  temperature: 0.5,
  seed: 0,
  top_k: 1,
};
