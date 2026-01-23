import { Accessor, Setter } from "solid-js";

export interface ClipboardEntry {
  name: Accessor<string>;
  setName: Setter<string>;
  content: Accessor<string>;
  setContent: Setter<string>;
  originalName: string; // Name when first copied to clipboard
  originalContent: string; // Content when first copied to clipboard
  sourceDirectory: string | null; // IDB directory origin (null = new file)
}
