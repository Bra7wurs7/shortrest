import { FileViewerMode } from "../types/fileViewerMode.enum";

export type AppMode = { mode: FileViewerMode; icon: string };

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".tiff", ".avif",
]);

export function getModesForExt(ext: string | null): AppMode[] {
  if (ext === ".md") {
    return [
      { mode: FileViewerMode.AiWriter, icon: "bx-code" },
      { mode: FileViewerMode.MdReader, icon: "bx-book-reader" },
    ];
  }
  if (ext === ".svg") {
    return [
      { mode: FileViewerMode.AiWriter, icon: "bx-code" },
      { mode: FileViewerMode.ImageViewer, icon: "bx-image" },
    ];
  }
  if (ext !== null && IMAGE_EXTS.has(ext)) {
    return [{ mode: FileViewerMode.ImageViewer, icon: "bx-image" }];
  }
  return [{ mode: FileViewerMode.AiWriter, icon: "bx-code" }];
}
