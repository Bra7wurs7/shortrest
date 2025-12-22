import { Accessor } from "solid-js";
import { localStorageOpenFilesKey } from "../App";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { BasicFile } from "../types/basicFile.interface";
import { parseFile } from "./parseFile.function";

/**
 * Persists the values of the provided array in localstorage
 * @param files The File array to store in the localstorage
 */
export function storeClipboard(files: Accessor<ReactiveFile[]>) {
  const serializedFiles: BasicFile[] = files().map((file) => {
    return {
      name: file.name(),
      content: file.content(),
    };
  });
  localStorage.setItem(
    localStorageOpenFilesKey,
    JSON.stringify(serializedFiles),
  );
}

export function loadClipboard(): ReactiveFile[] {
  const storedOpenFiles = localStorage.getItem(localStorageOpenFilesKey);
  if (storedOpenFiles) {
    const parsed = parseFile(storedOpenFiles);
    if (typeof parsed === "string") {
    } else {
      return parsed;
    }
  }
  return [];
}
