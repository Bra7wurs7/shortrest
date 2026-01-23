export interface ViewedFile {
  source: "idb" | "clipboard";
  directoryName: string | null; // For IDB source
  fileName: string; // Identifies the file
}
