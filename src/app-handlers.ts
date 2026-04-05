import { Accessor, Setter } from "solid-js";
import { ClipboardEntry } from "./types/clipboardEntry.interface";
import { ViewedFile } from "./types/viewedFile.interface";
import { ParsedFileName } from "./types/parsedFileName.interface";
import { ConfirmAction } from "./types/confirmAction.enum";
import {
  addDirectory,
  countFilesInDirectory,
  getFileContent,
  listAllDirectories,
  listFileNamesInDirectory,
  removeDirectory,
  removeFileFromDirectory,
  writeFileToDirectory,
} from "./functions/dbFilesInterface.functions";
import { parseFileName } from "./functions/parseFileName.function";
import { storeClipboard, storeViewedFile } from "./functions/storage.functions";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import { localStorageActiveDirectoryName } from "./constants/storageKeys";

/**
 * Ensures the clipboard always has one empty unnamed file ready for new content.
 * Returns the clipboard unchanged if an empty file exists, or a new clipboard with one appended.
 */
export function ensureEmptyClipboardFile(
  clipboard: ClipboardEntry[],
  activeDirectoryName: string | null,
): ClipboardEntry[] {
  const emptyEntries = clipboard.filter((e) => e.content === "");

  if (emptyEntries.length === 0) {
    const existingNames = clipboard.map((e) => e.name);
    let newName = "New File";
    let counter = 2;
    while (existingNames.includes(newName)) {
      newName = `New File ${counter}`;
      counter++;
    }

    const newEntry: ClipboardEntry = {
      name: newName,
      content: "",
      originalName: newName,
      originalContent: "",
      sourceDirectory: activeDirectoryName,
    };
    return [...clipboard, newEntry];
  }
  return clipboard;
}

/**
 * Resolve which ViewedFile to show when clicking a saved file.
 * Prefers clipboard file if one with the same name exists.
 */
export function resolveFileView(
  fileName: string,
  directoryName: string,
  clipboard: ClipboardEntry[],
): ViewedFile {
  const clipboardHasFile = clipboard.some((c) => c.name === fileName);

  return clipboardHasFile
    ? { source: "clipboard", directoryName: null, fileName }
    : { source: "idb", directoryName, fileName };
}

/**
 * Create a ViewedFile pointing at a clipboard entry.
 */
export function createClipboardView(fileName: string): ViewedFile {
  return {
    source: "clipboard",
    directoryName: null,
    fileName,
  };
}

/**
 * Get or create an editable clipboard entry for the current context.
 * Returns { clipboard, viewedFile, entry } with the updated state.
 */
export function getOrCreateEditableFile(
  viewedFile: ViewedFile | null,
  clipboard: ClipboardEntry[],
  idbFileContent: string,
  activeDirectoryName: string | null,
): { clipboard: ClipboardEntry[]; viewedFile: ViewedFile; entry: ClipboardEntry } {
  // If viewing a clipboard file, return that entry
  if (viewedFile?.source === "clipboard") {
    const existingEntry = clipboard.find((c) => c.name === viewedFile.fileName);
    if (existingEntry) {
      return { clipboard, viewedFile, entry: existingEntry };
    }
  }

  // If viewing an IDB file, check if it's already in clipboard
  if (viewedFile?.source === "idb" && viewedFile.fileName) {
    const existingEntry = clipboard.find((c) => c.name === viewedFile.fileName);
    if (existingEntry) {
      const newViewedFile = createClipboardView(viewedFile.fileName);
      return { clipboard, viewedFile: newViewedFile, entry: existingEntry };
    }

    // Create new clipboard entry from IDB file
    const newEntry: ClipboardEntry = {
      name: viewedFile.fileName,
      content: idbFileContent,
      originalName: viewedFile.fileName,
      originalContent: idbFileContent,
      sourceDirectory: viewedFile.directoryName,
    };
    const newClipboard = [...clipboard, newEntry];
    const newViewedFile = createClipboardView(viewedFile.fileName);
    return { clipboard: newClipboard, viewedFile: newViewedFile, entry: newEntry };
  }

  // No file is being viewed - create a new unnamed file
  const unnamedFileName = "unnamed file";

  const existingUnnamed = clipboard.find((c) => c.name === unnamedFileName);
  if (existingUnnamed) {
    const newViewedFile = createClipboardView(unnamedFileName);
    return { clipboard, viewedFile: newViewedFile, entry: existingUnnamed };
  }

  const newEntry: ClipboardEntry = {
    name: unnamedFileName,
    content: "",
    originalName: unnamedFileName,
    originalContent: "",
    sourceDirectory: activeDirectoryName,
  };
  const newClipboard = [...clipboard, newEntry];
  const newViewedFile = createClipboardView(unnamedFileName);
  return { clipboard: newClipboard, viewedFile: newViewedFile, entry: newEntry };
}

/**
 * Discard a clipboard entry (close without saving).
 * Returns the updated state, or null if the action requires confirmation.
 */
export function discardClipboardFile(
  index: number,
  clipboard: ClipboardEntry[],
  viewedFile: ViewedFile | null,
  confirmAction: ConfirmAction | null,
): {
  clipboard: ClipboardEntry[];
  viewedFile: ViewedFile | null;
  confirmAction: ConfirmAction | null;
  clearRightClick: boolean;
} | null {
  const entry = clipboard[index];
  if (!entry) return null;

  const hasChanges = entry.content !== entry.originalContent;

  if (hasChanges && confirmAction !== ConfirmAction.DiscardChanges) {
    // Needs confirmation
    return {
      clipboard,
      viewedFile,
      confirmAction: ConfirmAction.DiscardChanges,
      clearRightClick: false,
    };
  }

  // Confirmed or no changes — remove
  const newClipboard = clipboard.filter((_, i) => i !== index);
  let newViewedFile = viewedFile;
  if (viewedFile?.source === "clipboard" && viewedFile.fileName === entry.name) {
    newViewedFile = null;
  }

  return {
    clipboard: newClipboard,
    viewedFile: newViewedFile,
    confirmAction: null,
    clearRightClick: true,
  };
}

/**
 * Save a clipboard entry to IDB.
 * Does async IDB writes, returns state changes to apply.
 */
export async function saveClipboardFile(
  entry: ClipboardEntry,
  clipboard: ClipboardEntry[],
  activeDirName: string | null,
  activeDirFileNames: ParsedFileName[] | null,
  viewedFile: ViewedFile | null,
): Promise<{
  clipboard: ClipboardEntry[];
  dirFileNames: ParsedFileName[] | null;
  viewedFile: ViewedFile | null;
  idbFileContent: string | null;
}> {
  if (!activeDirName) {
    return { clipboard, dirFileNames: activeDirFileNames, viewedFile, idbFileContent: null };
  }

  const fileName = entry.name;
  const savedContent = entry.content;
  const fileAlreadyExists =
    activeDirFileNames?.some((f) => f.fullName === fileName) ?? false;

  await writeFileToDirectory(activeDirName, {
    name: fileName,
    content: savedContent,
  });

  // Update directory file list if new file
  let newDirFileNames = activeDirFileNames;
  if (!fileAlreadyExists && activeDirFileNames) {
    newDirFileNames = [...activeDirFileNames, parseFileName(fileName)];
  }

  // Remove from clipboard
  const newClipboard = clipboard.filter((e) => e !== entry);

  // Switch view to IDB source
  let newViewedFile = viewedFile;
  let idbFileContent: string | null = null;
  if (viewedFile?.source === "clipboard" && viewedFile.fileName === fileName) {
    idbFileContent = savedContent;
    newViewedFile = {
      source: "idb",
      directoryName: activeDirName,
      fileName,
    };
  }

  return {
    clipboard: newClipboard,
    dirFileNames: newDirFileNames,
    viewedFile: newViewedFile,
    idbFileContent,
  };
}

/**
 * Trash a saved file from a directory.
 * Returns null if confirmation is needed (sets confirmAction).
 */
export async function trashSavedFile(
  name: string,
  activeDirName: string | null,
  activeDirFileNames: ParsedFileName[] | null,
  confirmAction: ConfirmAction | null,
): Promise<{
  dirFileNames: ParsedFileName[] | null;
  confirmAction: ConfirmAction | null;
  clearRightClick: boolean;
  directoryNeedsUpdate: boolean;
} | null> {
  if (
    confirmAction !== ConfirmAction.TrashFile ||
    activeDirName === null ||
    activeDirFileNames === null
  ) {
    return {
      dirFileNames: activeDirFileNames,
      confirmAction: ConfirmAction.TrashFile,
      clearRightClick: false,
      directoryNeedsUpdate: false,
    };
  }

  await removeFileFromDirectory(activeDirName, name);
  const newNames = (await listFileNamesInDirectory(activeDirName)).map((fn) =>
    parseFileName(fn),
  );

  return {
    dirFileNames: newNames,
    confirmAction: null,
    clearRightClick: true,
    directoryNeedsUpdate: true,
  };
}

/**
 * Handle keyboard input in the left sidebar search field.
 * Returns new state to apply.
 */
export function handleSearchKeyUp(
  key: string,
  ctrlKey: boolean,
  inputText: string,
  activeDirName: string | null,
  clipboard: ClipboardEntry[],
  filteredClipboardNames: ParsedFileName[],
  filteredDirNames: ParsedFileName[] | null,
): {
  clipboard: ClipboardEntry[];
  viewedFile: ViewedFile | null;
  inputValue: string;
} | null {
  if (key !== "Enter") return null;

  if (ctrlKey) {
    // Ctrl+Enter: create new file in clipboard
    const newFileName = inputText || "unnamed file";
    const existingEntry = clipboard.find((c) => c.name === newFileName);

    let newClipboard = clipboard;
    if (!existingEntry) {
      const newEntry: ClipboardEntry = {
        name: newFileName,
        content: "",
        originalName: newFileName,
        originalContent: "",
        sourceDirectory: activeDirName,
      };
      newClipboard = [...clipboard, newEntry];
    }

    return {
      clipboard: newClipboard,
      viewedFile: createClipboardView(newFileName),
      inputValue: "",
    };
  }

  // Enter: select first matching file
  if (filteredClipboardNames.length === 1) {
    return {
      clipboard,
      viewedFile: createClipboardView(filteredClipboardNames[0].fullName),
      inputValue: "",
    };
  }

  if (
    filteredDirNames !== null &&
    activeDirName !== null &&
    filteredDirNames.length === 1 &&
    filteredClipboardNames.length === 0
  ) {
    return {
      clipboard,
      viewedFile: {
        source: "idb",
        directoryName: activeDirName,
        fileName: filteredDirNames[0].fullName,
      },
      inputValue: "",
    };
  }

  return null;
}

/**
 * Reconcile directories: ensure exactly one empty directory exists.
 * Returns the updated directory names list.
 */
export async function updateDirectories(
  currentDirectoryNames: string[],
  activeDirectoryName: string | null,
): Promise<string[]> {
  const directoryNamesAndSize = await Promise.all(
    currentDirectoryNames.map(async (name) => ({
      name,
      count: await countFilesInDirectory(name),
    })),
  );

  let foundEmptyDirectory: string | null = null;
  for (const dns of directoryNamesAndSize) {
    if (dns.count === 0) {
      if (dns.name === activeDirectoryName && !foundEmptyDirectory) {
        foundEmptyDirectory = dns.name;
      } else if (foundEmptyDirectory) {
        await removeDirectory(dns.name);
      } else {
        foundEmptyDirectory = dns.name;
      }
    }
  }
  if (foundEmptyDirectory === null) {
    await addDirectory(uuidv4());
  }

  return listAllDirectories();
}

export function onClickDownloadSavedFile(
  activeDirName: string | null,
  name: string,
) {
  if (activeDirName) {
    getFileContent(activeDirName, name)
      .then((content) => {
        if (content instanceof Blob) {
          saveAs(content, name);
        } else if (content !== null) {
          const blob = new Blob([content], { type: "text/plain" });
          saveAs(blob, name);
        } else {
          console.error(`File ${name} not found in directory ${activeDirName}`);
        }
      })
      .catch((error) => {
        console.error("Error downloading file:", error);
      });
  }
}

export function onClickDownloadClipboardFile(
  clipboard: ClipboardEntry[],
  name: string,
) {
  const entry = clipboard.find((c) => c.name === name);

  if (entry) {
    const blob = new Blob([entry.content], { type: "text/plain" });
    saveAs(blob, name);
  } else {
    console.error(`Clipboard file ${name} not found`);
  }
}

export function onClickUploadDirectory(
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryName: Accessor<string | null>,
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".zip";
  input.onchange = async (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    const zipFile = files[0];
    const zip = await JSZip.loadAsync(zipFile);

    const directoryName = uuidv4();
    await addDirectory(directoryName);

    const writePromises: Promise<void>[] = [];
    zip.forEach((relativePath, entry) => {
      if (entry.dir) return;
      const fileName = relativePath.split("/").pop() || relativePath;
      const isBinary = /\.(png|jpg|jpeg|gif|bmp|webp|ico|tiff?)$/i.test(fileName);
      writePromises.push(
        (isBinary ? entry.async("arraybuffer") : entry.async("string")).then(
          async (content) => {
            const fileContent = isBinary
              ? new Blob([content as ArrayBuffer], { type: `image/${fileName.split(".").pop()}` })
              : (content as string);
            await writeFileToDirectory(directoryName, {
              name: fileName,
              content: fileContent,
            });
          },
        ),
      );
    });

    await Promise.all(writePromises);
    setDirectoryNames(
      await updateDirectories(directoryNames(), activeDirectoryName()),
    );
  };

  input.click();
}

export function onClickDownloadDirectory(name: string) {
  listFileNamesInDirectory(name)
    .then((fileNames) => {
      if (fileNames.length === 0) {
        console.warn(`No files found in directory ${name}`);
        return;
      }

      const zip = new JSZip();
      const promises = fileNames.map((fileName) => {
        return getFileContent(name, fileName)
          .then((content) => {
            if (content !== null) {
              zip.file(fileName, content);
            } else {
              console.error(`File ${fileName} not found in directory ${name}`);
            }
          })
          .catch((error) => {
            console.error(`Error getting file ${fileName}:`, error);
          });
      });

      return Promise.all(promises)
        .then(() => zip.generateAsync({ type: "blob" }))
        .then((zipBlob) => {
          saveAs(zipBlob, `${name}.zip`);
        })
        .catch((error) => {
          console.error("Error generating ZIP:", error);
        });
    })
    .catch((error) => {
      console.error(`Error listing files in directory ${name}:`, error);
    });
}

export async function onClickDeleteDirectory(
  name: string,
  directoryNames: string[],
  activeDirectoryName: string | null,
): Promise<{ directoryNames: string[]; activeDirectoryName: string | null }> {
  await removeDirectory(name);
  const filtered = directoryNames.filter((n) => n !== name);
  const newDirNames = await updateDirectories(filtered, activeDirectoryName);

  let newActiveDirName = activeDirectoryName;
  if (activeDirectoryName === name) {
    newActiveDirName = newDirNames[0] ?? null;
    if (newActiveDirName) {
      localStorage.setItem(localStorageActiveDirectoryName, newActiveDirName);
    }
  }

  return { directoryNames: newDirNames, activeDirectoryName: newActiveDirName };
}

export function onInputExistingFileName(
  newNameEvent: Event & {
    currentTarget: HTMLDivElement;
    target: Element;
  },
): string | null {
  const newFileName: string | undefined = (
    newNameEvent.target.firstChild as (ChildNode | null) & { data: string }
  ).data;
  return newFileName ?? null;
}

/**
 * Rename a clipboard file. Returns updated clipboard, or null if name conflict.
 */
export function renameClipboardFile(
  oldName: string,
  newName: string,
  clipboard: ClipboardEntry[],
  viewedFile: ViewedFile | null,
): { clipboard: ClipboardEntry[]; viewedFile: ViewedFile | null } | null {
  if (clipboard.some((c) => c.name === newName)) return null;

  const newClipboard = clipboard.map((c) =>
    c.name === oldName ? { ...c, name: newName } : c,
  );

  let newViewedFile = viewedFile;
  if (viewedFile?.source === "clipboard" && viewedFile.fileName === oldName) {
    newViewedFile = { ...viewedFile, fileName: newName };
  }

  return { clipboard: newClipboard, viewedFile: newViewedFile };
}

/**
 * Rename a saved file in a directory.
 */
export async function renameSavedFile(
  oldName: string,
  newName: string,
  activeDirName: string | null,
  activeDirFileNames: ParsedFileName[] | null,
  viewedFile: ViewedFile | null,
): Promise<{
  dirFileNames: ParsedFileName[] | null;
  viewedFile: ViewedFile | null;
} | null> {
  if (!activeDirName || !activeDirFileNames) return null;

  const fileWithSameNameAlreadyExists = activeDirFileNames.some(
    (sf) => sf.baseName === newName,
  );
  if (fileWithSameNameAlreadyExists) return null;

  const fileContent = await getFileContent(activeDirName, oldName);
  await writeFileToDirectory(activeDirName, {
    name: newName,
    content: fileContent ?? "",
  });
  await removeFileFromDirectory(activeDirName, oldName);

  const newDirFileNames = (
    await listFileNamesInDirectory(activeDirName)
  ).map((fn) => parseFileName(fn));

  let newViewedFile = viewedFile;
  if (
    viewedFile?.source === "idb" &&
    viewedFile.fileName === oldName &&
    viewedFile.directoryName === activeDirName
  ) {
    newViewedFile = { ...viewedFile, fileName: newName };
  }

  return { dirFileNames: newDirFileNames, viewedFile: newViewedFile };
}
