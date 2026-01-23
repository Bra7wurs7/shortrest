import { Accessor } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { BasicFile } from "../types/basicFile.interface";
import { localStorageOpenFilesKey } from "../constants/storageKeys";

/**
 * Persists the values of the provided array in localstorage
 * @param files The File array to store in the localstorage
 */
export function storeOpenFiles(files: Accessor<ReactiveFile[]>) {
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
