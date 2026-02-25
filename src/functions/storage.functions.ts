import { Accessor, createSignal } from "solid-js";
import {
  localStorageClipboardKey,
  localStorageViewedFileKey,
} from "../constants/storageKeys";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ViewedFile } from "../types/viewedFile.interface";

interface SerializedClipboardEntry {
  name: string;
  content: string;
  originalName: string;
  originalContent: string;
  sourceDirectory: string | null;
}

/**
 * Loads clipboard entries from localStorage
 */
export function loadClipboard(): ClipboardEntry[] {
  const storedClipboard = localStorage.getItem(localStorageClipboardKey);
  if (storedClipboard) {
    try {
      return parseClipboard(storedClipboard);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Persists clipboard entries to localStorage
 */
export function storeClipboard(entries: Accessor<ClipboardEntry[]>) {
  const serializedEntries: SerializedClipboardEntry[] = entries().map(
    (entry) => ({
      name: entry.name(),
      content: entry.content(),
      originalName: entry.originalName,
      originalContent: entry.originalContent,
      sourceDirectory: entry.sourceDirectory,
    }),
  );
  localStorage.setItem(
    localStorageClipboardKey,
    JSON.stringify(serializedEntries),
  );
}

/**
 * Loads viewed file state from localStorage
 */
export function loadViewedFile(): ViewedFile | null {
  const stored = localStorage.getItem(localStorageViewedFileKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed.source === "string" &&
        (parsed.source === "idb" || parsed.source === "clipboard") &&
        typeof parsed.fileName === "string"
      ) {
        return parsed as ViewedFile;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Stores viewed file state to localStorage
 */
export function storeViewedFile(viewedFile: ViewedFile | null) {
  if (viewedFile) {
    localStorage.setItem(localStorageViewedFileKey, JSON.stringify(viewedFile));
  } else {
    localStorage.removeItem(localStorageViewedFileKey);
  }
}

/**
 * Parses a JSON string into ClipboardEntry array. Throws on invalid input.
 */
function parseClipboard(clipboardJson: string): ClipboardEntry[] {
  const entries: SerializedClipboardEntry[] = JSON.parse(clipboardJson);

  if (!Array.isArray(entries)) {
    throw new Error("Clipboard data is not an array");
  }

  if (
    !entries.every(
      (entry) =>
        "name" in entry &&
        typeof entry.name === "string" &&
        "content" in entry &&
        typeof entry.content === "string" &&
        "originalName" in entry &&
        typeof entry.originalName === "string" &&
        "originalContent" in entry &&
        typeof entry.originalContent === "string" &&
        "sourceDirectory" in entry &&
        (entry.sourceDirectory === null ||
          typeof entry.sourceDirectory === "string"),
    )
  ) {
    throw new Error("Clipboard data contains invalid entries");
  }

  return entries.map(
    ({ name, content, originalName, originalContent, sourceDirectory }) => {
      const [n, setN] = createSignal(name);
      const [c, setC] = createSignal(content);

      return {
        name: n,
        setName: setN,
        content: c,
        setContent: setC,
        originalName,
        originalContent,
        sourceDirectory,
      };
    },
  );
}
