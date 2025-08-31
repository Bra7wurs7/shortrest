import { localStorageActiveFileNameKey } from "../App";

export function storeActiveFileName(name: string) {
  localStorage.setItem(localStorageActiveFileNameKey, name);
}
