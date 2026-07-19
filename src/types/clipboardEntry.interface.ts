export interface ClipboardEntry {
  name: string;
  content: string;
  originalName: string; // Name when first copied to clipboard
  originalContent: string; // Content when first copied to clipboard
  sourceDirectory: string | null; // IDB directory origin (null = new file)
}
