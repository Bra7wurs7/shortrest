import { localStorageActiveFileNameKey } from "../constants/storageKeys";

export function storeActiveFileName(name: string) {
  localStorage.setItem(localStorageActiveFileNameKey, name);
}
