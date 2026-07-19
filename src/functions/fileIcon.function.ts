/** Returns a boxicon class (without the "bx " prefix) for a given file. */
export function getFileIcon(baseName: string, ext: string): string {
  if (baseName === "") return "bxs-tag-alt";
  switch (ext) {
    case ".md":   return "bxs-file-md";
    case ".png":  return "bxs-file-png";
    case ".jpg":
    case ".jpeg": return "bxs-file-jpg";
    case ".gif":  return "bxs-file-gif";
    case ".svg":
    case ".webp":
    case ".avif":
    case ".bmp":
    case ".ico":
    case ".tiff": return "bxs-file-image";
    case ".pdf":  return "bxs-file-pdf";
    case ".html":
    case ".htm":  return "bxs-file-html";
    case ".css":  return "bxs-file-css";
    case ".js":
    case ".ts":
    case ".jsx":
    case ".tsx":
    case ".mjs":  return "bxs-file-js";
    case ".json": return "bxs-file-json";
    case ".mp4":
    case ".mov":
    case ".avi":
    case ".mkv":
    case ".webm": return "bxs-video";
    case ".mp3":
    case ".wav":
    case ".flac":
    case ".ogg":
    case ".m4a":  return "bxs-music";
    case ".zip":
    case ".tar":
    case ".gz":
    case ".7z":
    case ".rar":  return "bxs-file-archive";
    case ".doc":
    case ".docx": return "bxs-file-doc";
    case ".txt":  return "bxs-file-txt";
    case ".csv":
    case ".xls":
    case ".xlsx": return "bxs-spreadsheet";
    default:      return "bxs-file";
  }
}
