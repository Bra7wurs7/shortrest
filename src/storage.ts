import { Accessor, createSignal } from "solid-js";
import { ReactiveFile } from "./types/reactiveFile.interface";
import { BasicFile } from "./types/basicFile.interface";
import {
  localStorageActiveFileNameKey,
  localStorageOpenFilesKey,
} from "./constants/storageKeys";

/**
 * Loads open files from localStorage
 */
export function loadOpenFiles(): ReactiveFile[] {
  const storedOpenFiles = localStorage.getItem(localStorageOpenFilesKey);
  if (storedOpenFiles) {
    const parsed = parseFile(storedOpenFiles);
    if (typeof parsed !== "string") {
      return parsed;
    }
  }
  return [];
}

/**
 * Persists open files to localStorage
 */
export function storeOpenFiles(files: Accessor<ReactiveFile[]>) {
  const serializedFiles: BasicFile[] = files().map((file) => ({
    name: file.name(),
    content: file.content(),
  }));
  localStorage.setItem(
    localStorageOpenFilesKey,
    JSON.stringify(serializedFiles),
  );
}

/**
 * Stores the active file name to localStorage
 */
export function storeActiveFileName(name: string) {
  localStorage.setItem(localStorageActiveFileNameKey, name);
}

/**
 * Parses a JSON string into ReactiveFile array
 */
function parseFile(filesJson: string): ReactiveFile[] | string {
  let files: BasicFile[];
  try {
    files = JSON.parse(filesJson);
  } catch (error) {
    return `Error parsing JSON: ${error}`;
  }

  if (!Array.isArray(files)) {
    return "The parsed result is not an array";
  }

  if (
    files.every(
      (file) =>
        "name" in file &&
        typeof file.name === "string" &&
        "content" in file &&
        typeof file.content === "string",
    )
  ) {
    return files.map(({ name, content }) => {
      const [n, setN] = createSignal(name);
      const [c, setC] = createSignal(content);

      return {
        name: n,
        setName: setN,
        content: c,
        setContent: setC,
      };
    });
  } else {
    return "The array contains elements that are not valid File objects";
  }
}
