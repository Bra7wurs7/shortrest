import { localStorageOpenFilesKey } from "../App";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { parseFile } from "./parseFile.function";

export function loadOpenFiles(): ReactiveFile[] {
  const storedOpenFiles = localStorage.getItem(localStorageOpenFilesKey);
  if (storedOpenFiles) {
    const parsed = parseFile(storedOpenFiles);
    if (typeof parsed === "string") {
      console.log(parsed);
    } else {
      return parsed;
    }
  }
  return [];
}
