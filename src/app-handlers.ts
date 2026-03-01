import { Accessor, createSignal, Setter } from "solid-js";
import { ClipboardEntry } from "./types/clipboardEntry.interface";
import { ViewedFile } from "./types/viewedFile.interface";
import { ParsedFileName } from "./types/parsedFileName.interface";
import { ConfirmAction } from "./types/confirmAction.enum";
import { BasicFile } from "./types/basicFile.interface";
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
 * Similar to how directories always have one empty directory.
 */
export function ensureEmptyClipboardFile(
  clipboard: Accessor<ClipboardEntry[]>,
  setClipboard: Setter<ClipboardEntry[]>,
  activeDirectoryName: Accessor<string | null>,
) {
  const entries = clipboard();
  const emptyEntries = entries.filter((e) => e.content() === "");

  if (emptyEntries.length === 0) {
    // Find a unique name
    const existingNames = entries.map((e) => e.name());
    let newName = "New File";
    let counter = 2;
    while (existingNames.includes(newName)) {
      newName = `New File ${counter}`;
      counter++;
    }

    const [name, setName] = createSignal(newName);
    const [content, setContent] = createSignal("");
    const newEntry: ClipboardEntry = {
      name,
      setName,
      content,
      setContent,
      originalName: newName,
      originalContent: "",
      sourceDirectory: activeDirectoryName(),
    };
    setClipboard([...entries, newEntry]);
    storeClipboard(clipboard);
  }
}

/**
 * Click a saved file in the directory listing.
 * Prefers clipboard file if one with the same name exists.
 */
export function onClickSavedFile(
  fileName: string,
  directoryName: string,
  clipboard: Accessor<ClipboardEntry[]>,
  setViewedFile: Setter<ViewedFile | null>,
) {
  const clipboardHasFile = clipboard().some((c) => c.name() === fileName);

  const viewedFile: ViewedFile = clipboardHasFile
    ? { source: "clipboard", directoryName: null, fileName }
    : { source: "idb", directoryName, fileName };

  setViewedFile(viewedFile);
  storeViewedFile(viewedFile);
}

/**
 * Click a clipboard entry to view it
 */
export function onClickClipboardFile(
  fileName: string,
  setViewedFile: Setter<ViewedFile | null>,
) {
  const viewedFile: ViewedFile = {
    source: "clipboard",
    directoryName: null,
    fileName,
  };
  setViewedFile(viewedFile);
  storeViewedFile(viewedFile);
}

/**
 * Get or create an editable clipboard entry for the current context.
 * Used when user edits a file or LLM generates content.
 */
export function getOrCreateEditableFile(
  viewedFile: Accessor<ViewedFile | null>,
  setViewedFile: Setter<ViewedFile | null>,
  clipboard: Accessor<ClipboardEntry[]>,
  setClipboard: Setter<ClipboardEntry[]>,
  idbFileContent: Accessor<string>,
  activeDirectoryName: Accessor<string | null>,
): ClipboardEntry {
  const vf = viewedFile();

  // If viewing a clipboard file, return that entry
  if (vf?.source === "clipboard") {
    const existingEntry = clipboard().find((c) => c.name() === vf.fileName);
    if (existingEntry) {
      return existingEntry;
    }
  }

  // If viewing an IDB file, check if it's already in clipboard
  if (vf?.source === "idb" && vf.fileName) {
    const existingEntry = clipboard().find((c) => c.name() === vf.fileName);
    if (existingEntry) {
      // Switch to clipboard view
      const newViewedFile: ViewedFile = {
        source: "clipboard",
        directoryName: null,
        fileName: vf.fileName,
      };
      setViewedFile(newViewedFile);
      storeViewedFile(newViewedFile);
      return existingEntry;
    }

    // Create new clipboard entry from IDB file
    const content = idbFileContent();
    const [name, setName] = createSignal(vf.fileName);
    const [contentSignal, setContent] = createSignal(content);
    const newEntry: ClipboardEntry = {
      name,
      setName,
      content: contentSignal,
      setContent,
      originalName: vf.fileName,
      originalContent: content,
      sourceDirectory: vf.directoryName,
    };
    setClipboard([...clipboard(), newEntry]);
    storeClipboard(clipboard);

    // Switch to clipboard view
    const newViewedFile: ViewedFile = {
      source: "clipboard",
      directoryName: null,
      fileName: vf.fileName,
    };
    setViewedFile(newViewedFile);
    storeViewedFile(newViewedFile);
    return newEntry;
  }

  // No file is being viewed - create a new unnamed file
  const unnamedFileName = "unnamed file";

  // Check if an unnamed file already exists in clipboard
  const existingUnnamed = clipboard().find((c) => c.name() === unnamedFileName);
  if (existingUnnamed) {
    const newViewedFile: ViewedFile = {
      source: "clipboard",
      directoryName: null,
      fileName: unnamedFileName,
    };
    setViewedFile(newViewedFile);
    storeViewedFile(newViewedFile);
    return existingUnnamed;
  }

  // Create new unnamed file
  const [name, setName] = createSignal(unnamedFileName);
  const [content, setContent] = createSignal("");
  const newEntry: ClipboardEntry = {
    name,
    setName,
    content,
    setContent,
    originalName: unnamedFileName,
    originalContent: "",
    sourceDirectory: activeDirectoryName(),
  };
  setClipboard([...clipboard(), newEntry]);
  storeClipboard(clipboard);

  const newViewedFile: ViewedFile = {
    source: "clipboard",
    directoryName: null,
    fileName: unnamedFileName,
  };
  setViewedFile(newViewedFile);
  storeViewedFile(newViewedFile);
  return newEntry;
}

/**
 * Discard a clipboard entry (close without saving)
 */
export async function onDiscardClipboardFile(
  index: number,
  clipboard: Accessor<ClipboardEntry[]>,
  setClipboard: Setter<ClipboardEntry[]>,
  viewedFile: Accessor<ViewedFile | null>,
  setViewedFile: Setter<ViewedFile | null>,
  confirmAction: Accessor<ConfirmAction | null>,
  setConfirmAction: Setter<ConfirmAction | null>,
  setRightClickedClipboardFile: Setter<string | null>,
) {
  const currentClipboard = clipboard();
  const entry = currentClipboard[index];

  if (!entry) return;

  const hasChanges = entry.content() !== entry.originalContent;

  if (hasChanges) {
    if (confirmAction() === ConfirmAction.DiscardChanges) {
      currentClipboard.splice(index, 1);
      setClipboard([...currentClipboard]);
      setConfirmAction(null);
      setRightClickedClipboardFile(null);

      // If we were viewing this file, clear the view
      const vf = viewedFile();
      if (vf?.source === "clipboard" && vf.fileName === entry.name()) {
        setViewedFile(null);
        storeViewedFile(null);
      }
    } else {
      setConfirmAction(ConfirmAction.DiscardChanges);
    }
  } else {
    currentClipboard.splice(index, 1);
    setClipboard([...currentClipboard]);
    setConfirmAction(null);
    setRightClickedClipboardFile(null);

    // If we were viewing this file, clear the view
    const vf = viewedFile();
    if (vf?.source === "clipboard" && vf.fileName === entry.name()) {
      setViewedFile(null);
      storeViewedFile(null);
    }
  }

  storeClipboard(clipboard);
}

/**
 * Save a clipboard entry to IDB
 */
export async function onSaveClipboardFile(
  index: number,
  clipboard: Accessor<ClipboardEntry[]>,
  setClipboard: Setter<ClipboardEntry[]>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryFileNames: Accessor<ParsedFileName[] | null>,
  setActiveDirectoryFileNames: Setter<ParsedFileName[] | null>,
  activeDirectoryName: Accessor<string | null>,
  viewedFile: Accessor<ViewedFile | null>,
  setViewedFile: Setter<ViewedFile | null>,
  setRightClickedClipboardFile: Setter<string | null>,
  setIdbFileContent?: Setter<string>,
) {
  const entry = clipboard()[index];
  const activeDirName = activeDirectoryName();
  const activeDirFileNames = activeDirectoryFileNames();

  if (!entry || !activeDirName) return;

  const targetDir = activeDirName;
  const fileName = entry.name();
  const savedContent = entry.content();
  const fileAlreadyExists =
    activeDirFileNames?.some((f) => f.fullName === fileName) ?? false;

  await writeFileToDirectory(targetDir, {
    name: fileName,
    content: savedContent,
  });

  // Update directory file list if new file
  if (!fileAlreadyExists && activeDirFileNames) {
    setActiveDirectoryFileNames([
      ...activeDirFileNames,
      parseFileName(fileName),
    ]);
  }

  // Remove from clipboard (re-find by reference since index may be stale after await)
  const currentClipboard = clipboard();
  const currentIndex = currentClipboard.indexOf(entry);
  if (currentIndex !== -1) {
    currentClipboard.splice(currentIndex, 1);
  }
  setClipboard([...currentClipboard]);
  storeClipboard(clipboard);
  setRightClickedClipboardFile(null);

  // Switch view to IDB source, pre-filling the content to avoid an empty flash
  const vf = viewedFile();
  if (vf?.source === "clipboard" && vf.fileName === fileName) {
    if (setIdbFileContent) {
      setIdbFileContent(savedContent);
    }
    const newViewedFile: ViewedFile = {
      source: "idb",
      directoryName: targetDir,
      fileName,
    };
    setViewedFile(newViewedFile);
    storeViewedFile(newViewedFile);
  }

  await onUpdateDirectory(
    directoryNames,
    setDirectoryNames,
    activeDirectoryName,
  );
}

export async function onClickTrashSavedFile(
  name: string,
  activeDirectoryName: Accessor<string | null>,
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>,
  setActiveDirectoryParsedFileNames: Setter<ParsedFileName[] | null>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  confirmAction: Accessor<ConfirmAction | null>,
  setConfirmAction: Setter<ConfirmAction | null>,
  setRightClickedSavedFile: Setter<string | null>,
) {
  const activeDirName = activeDirectoryName();
  const activeDirFileNames = activeDirectoryParsedFileNames();

  if (
    confirmAction() === ConfirmAction.TrashFile &&
    activeDirName !== null &&
    activeDirFileNames !== null
  ) {
    await removeFileFromDirectory(activeDirName, name);
    setActiveDirectoryParsedFileNames(
      (await listFileNamesInDirectory(activeDirName)).map((fn) =>
        parseFileName(fn),
      ),
    );
    await onUpdateDirectory(
      directoryNames,
      setDirectoryNames,
      activeDirectoryName,
    );
    setConfirmAction(null);
    setRightClickedSavedFile(null);
  } else {
    setConfirmAction(ConfirmAction.TrashFile);
  }
}

/**
 * Handle keyboard input in the left sidebar search field
 */
export function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  activeDirectoryName: Accessor<string | null>,
  setInputValue: Setter<string>,
  clipboard: Accessor<ClipboardEntry[]>,
  setClipboard: Setter<ClipboardEntry[]>,
  filteredParsedClipboardFileNames: Accessor<ParsedFileName[]>,
  filteredParsedDirectoryFileNames: Accessor<ParsedFileName[] | null>,
  setViewedFile: Setter<ViewedFile | null>,
) {
  const filtrdAllFileNames = filteredParsedDirectoryFileNames();
  const filtrdClipboardFiles = filteredParsedClipboardFileNames();
  const activeDirName = activeDirectoryName();

  setInputValue(e.currentTarget.value);
  switch (e.key) {
    case "Enter":
      if (e.ctrlKey) {
        // Ctrl+Enter: create new file in clipboard
        const newFileName = e.currentTarget.value || "unnamed file";
        const existingEntry = clipboard().find((c) => c.name() === newFileName);

        if (!existingEntry) {
          const [name, setName] = createSignal(newFileName);
          const [content, setContent] = createSignal("");
          const newEntry: ClipboardEntry = {
            name,
            setName,
            content,
            setContent,
            originalName: newFileName,
            originalContent: "",
            sourceDirectory: activeDirName,
          };
          setClipboard([...clipboard(), newEntry]);
          storeClipboard(clipboard);
        }

        const viewedFile: ViewedFile = {
          source: "clipboard",
          directoryName: null,
          fileName: newFileName,
        };
        setViewedFile(viewedFile);
        storeViewedFile(viewedFile);
        setInputValue("");
      } else {
        // Enter: select first matching file
        if (filtrdClipboardFiles.length === 1) {
          const viewedFile: ViewedFile = {
            source: "clipboard",
            directoryName: null,
            fileName: filtrdClipboardFiles[0].fullName,
          };
          setViewedFile(viewedFile);
          storeViewedFile(viewedFile);
          setInputValue("");
        } else if (
          filtrdAllFileNames !== null &&
          activeDirName !== null &&
          filtrdAllFileNames.length === 1 &&
          filtrdClipboardFiles.length === 0
        ) {
          const viewedFile: ViewedFile = {
            source: "idb",
            directoryName: activeDirName,
            fileName: filtrdAllFileNames[0].fullName,
          };
          setViewedFile(viewedFile);
          storeViewedFile(viewedFile);
          setInputValue("");
        }
      }
      break;
    default:
      break;
  }
}

export async function onUpdateDirectory(
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryName?: Accessor<string | null>,
) {
  const activeDirName = activeDirectoryName?.();
  const directoryNamesAndSize: { name: string; count: number }[] =
    await Promise.all(
      directoryNames().map(async (name) => {
        return { name, count: await countFilesInDirectory(name) };
      }),
    );
  let foundEmptyDirectory: string | null = null;
  for (const dns of directoryNamesAndSize) {
    if (dns.count === 0) {
      // Prefer keeping the active directory as the empty slot
      if (dns.name === activeDirName && !foundEmptyDirectory) {
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
  setDirectoryNames(await listAllDirectories());
}

export function onClickDownloadSavedFile(
  activeDirectoryName: Accessor<string | null>,
  name: string,
) {
  const activeDirName = activeDirectoryName();

  if (activeDirName) {
    getFileContent(activeDirName, name)
      .then((content) => {
        if (content !== null) {
          const blob = new Blob([content], { type: "text/plain" });
          saveAs(blob, name);
        } else {
          console.error(
            `File ${name} not found in directory ${activeDirectoryName()}`,
          );
        }
      })
      .catch((error) => {
        console.error("Error downloading file:", error);
      });
  }
}

export function onClickDownloadClipboardFile(
  clipboard: Accessor<ClipboardEntry[]>,
  name: string,
) {
  const entry = clipboard().find((c) => c.name() === name);

  if (entry) {
    const content = entry.content();
    const blob = new Blob([content], { type: "text/plain" });
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
  input.webkitdirectory = true;
  input.onchange = async (event) => {
    const files = (event.target as HTMLInputElement).files;

    if (!files) return;

    const directoryName = uuidv4();
    await addDirectory(directoryName);

    const writePromises: Promise<void>[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      writePromises.push(
        new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const content = reader.result as string;
              await writeFileToDirectory(directoryName, {
                name: file.name,
                content,
              });
              resolve();
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        }),
      );
    }

    await Promise.all(writePromises);
    await onUpdateDirectory(
      directoryNames,
      setDirectoryNames,
      activeDirectoryName,
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
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryName: Accessor<string | null>,
  setActiveDirectoryName: Setter<string | null>,
) {
  await removeDirectory(name);
  setDirectoryNames(directoryNames().filter((n) => n !== name));
  await onUpdateDirectory(directoryNames, setDirectoryNames, activeDirectoryName);
  if (activeDirectoryName() === name) {
    const next = directoryNames()[0] ?? null;
    setActiveDirectoryName(next);
    if (next) {
      localStorage.setItem(localStorageActiveDirectoryName, next);
    }
  }
}

export function onInputExistingFileName(
  newNameEvent: Event & {
    currentTarget: HTMLDivElement;
    target: Element;
  },
  fileNameChangeSetter: Setter<string | null>,
) {
  const newFileName: string | undefined = (
    newNameEvent.target.firstChild as (ChildNode | null) & { data: string }
  ).data;
  if (newFileName !== undefined) {
    fileNameChangeSetter(newFileName);
  }
}

export function onRenameClipboardFile(
  oldName: string | null,
  newName: string | null,
  clipboard: Accessor<ClipboardEntry[]>,
) {
  const fileWithSameNameAlreadyExists = clipboard().some(
    (c) => c.name() === newName,
  );

  if (fileWithSameNameAlreadyExists) return;

  const entryToRename = clipboard().find((c) => c.name() === oldName);
  if (entryToRename && newName !== null) {
    entryToRename.setName(newName);
  }
  storeClipboard(clipboard);
}

export async function onRenameSavedFile(
  oldName: string | null,
  newName: string | null,
  activeDirectorParsedFileNames: Accessor<ParsedFileName[] | null>,
  setActiveDirectorParsedFileNames: Setter<ParsedFileName[] | null>,
  activeDirectoryName: Accessor<string | null>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
) {
  const activeDirName = activeDirectoryName();
  const activeDirFileNames = activeDirectorParsedFileNames();
  const fileWithSameNameAlreadyExists =
    activeDirFileNames !== null
      ? activeDirFileNames.some((sf) => sf.baseName === newName)
      : false;

  if (
    activeDirName !== null &&
    oldName !== null &&
    newName !== null &&
    !fileWithSameNameAlreadyExists &&
    activeDirFileNames !== null
  ) {
    const fileContent = await getFileContent(activeDirName, oldName);
    const newFile: BasicFile = { name: newName, content: fileContent ?? "" };
    await writeFileToDirectory(activeDirName, newFile);
    await removeFileFromDirectory(activeDirName, oldName);
    setActiveDirectorParsedFileNames(
      (await listFileNamesInDirectory(activeDirName)).map((fn) =>
        parseFileName(fn),
      ),
    );
  }
}
