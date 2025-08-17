import { localStorageOpenFilesKey } from "../App";
import { OpenFile } from "../types/openFile.interface";
import { parseFile } from "./parseFile.function";

export function loadOpenFiles(): OpenFile[] {
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
