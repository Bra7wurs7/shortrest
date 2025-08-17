import { Accessor } from "solid-js";
import { OpenFile } from "../types/openFile.interface";
import { localStorageOpenFilesKey } from "../App";

/**
 * Persists the values of the provided array in localstorage
 * @param files The File array to store in the localstorage
 */
export function storeOpenFiles(files: Accessor<OpenFile[]>) {
  const serializedFiles = files().map((file) => ({
    name: file.name(),
    content: file.content(),
  }));
  localStorage.setItem(
    localStorageOpenFilesKey,
    JSON.stringify(serializedFiles),
  );
}
