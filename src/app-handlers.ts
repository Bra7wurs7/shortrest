import { Accessor, createSignal, Setter } from "solid-js";
import { ReactiveFile } from "./types/reactiveFile.interface";
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
import { storeActiveFileName, storeOpenFiles } from "./storage";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";

export function onClickSavedFile(
  fileName: string,
  activeDirectoryName: Accessor<string | null>,
  openFiles: Accessor<ReactiveFile[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
  setActiveFileName: Setter<string | null>,
) {
  const fileIndexInOpenFiles = openFiles().findIndex(
    (f) => f.name() === fileName,
  );

  if (fileIndexInOpenFiles === -1) {
    const [name, setName] = createSignal<string>(fileName);
    const [content, setContent] = createSignal<string>("");
    const activeDirName = activeDirectoryName();
    if (activeDirName !== null) {
      getFileContent(activeDirName, fileName).then((content) => {
        if (content !== null) {
          setContent(content);
        } else {
          throw new Error("file not found");
        }
        storeOpenFiles(openFiles);
      });
      setOpenFiles([
        ...openFiles(),
        {
          name,
          setName,
          content,
          setContent,
        },
      ]);
    }
  }
  setActiveFileName(fileName);
}

export async function onClickCloseOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  activeDirectoryName: Accessor<string | null>,
  setOpenFiles: Setter<ReactiveFile[]>,
  confirmAction: Accessor<ConfirmAction | null>,
  setConfirmAction: Setter<ConfirmAction | null>,
  setRightClickedOpenFile: Setter<string | null>,
) {
  const currentOpenFiles = openFiles();
  const openFile = currentOpenFiles[index];
  const activeDirName = activeDirectoryName();

  if (openFile) {
    const savedFileContent =
      activeDirName !== null
        ? await getFileContent(activeDirName, openFile.name())
        : null;

    const changesExist =
      savedFileContent !== null && savedFileContent !== openFile.content();

    if (savedFileContent === null || changesExist) {
      if (confirmAction() === ConfirmAction.DiscardChanges) {
        currentOpenFiles.splice(index, 1);
        setOpenFiles([...currentOpenFiles]);
        setConfirmAction(null);
        setRightClickedOpenFile(null);
      } else {
        setConfirmAction(ConfirmAction.DiscardChanges);
      }
    } else {
      currentOpenFiles.splice(index, 1);
      setOpenFiles([...currentOpenFiles]);
      setConfirmAction(null);
      setRightClickedOpenFile(null);
    }

    storeOpenFiles(openFiles);
  }
}

export function onClickSaveOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryFileNames: Accessor<ParsedFileName[] | null>,
  setActiveDirectoryFileNames: Setter<ParsedFileName[] | null>,
  activeDirectoryName: Accessor<string | null>,
) {
  const openFile: ReactiveFile | null = openFiles()[index];
  const activeDirName: string | null = activeDirectoryName();
  const activeDirFileNames: ParsedFileName[] | null =
    activeDirectoryFileNames();
  const fileAlreadyExists =
    activeDirFileNames === null
      ? false
      : !!activeDirFileNames.find((adfn) => adfn.fullName === openFile.name());

  if (openFile && activeDirName && activeDirFileNames) {
    writeFileToDirectory(activeDirName, {
      name: openFile.name(),
      content: openFile.content(),
    }).then(() => {
      if (!fileAlreadyExists)
        setActiveDirectoryFileNames([
          ...activeDirFileNames,
          parseFileName(openFile.name()),
        ]);
      onUpdateDirectory(directoryNames, setDirectoryNames).then();
    });
  }
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
    await onUpdateDirectory(directoryNames, setDirectoryNames);
    setConfirmAction(null);
    setRightClickedSavedFile(null);
  } else {
    setConfirmAction(ConfirmAction.TrashFile);
  }
}

export function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  activeDirectoryName: Accessor<string | null>,
  setInputValue: Setter<string>,
  openFiles: Accessor<ReactiveFile[]>,
  filteredParsedOpenFileNames: Accessor<ParsedFileName[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
  filteredParsedAllFileNames: Accessor<ParsedFileName[] | null>,
  setActiveFile: Setter<string | null>,
) {
  const filtrdAllFileNames = filteredParsedAllFileNames();
  const filtrdOpenFiles = filteredParsedOpenFileNames();
  const activeDirName = activeDirectoryName();

  setInputValue(e.currentTarget.value);
  switch (e.key) {
    case "Enter":
      if (
        e.ctrlKey &&
        !openFiles().some((of) => of.name() === e.currentTarget.value)
      ) {
        const [name, setName] = createSignal<string>(e.currentTarget.value);
        const [content, setContent] = createSignal<string>("");
        setOpenFiles([...openFiles(), { name, setName, content, setContent }]);
        setActiveFile(name);
        storeActiveFileName(name());
        setInputValue("");
        storeOpenFiles(openFiles);
      } else {
        if (filtrdOpenFiles.length === 1) {
          setActiveFile(filtrdOpenFiles[0].fullName);
          storeActiveFileName(filtrdOpenFiles[0].fullName);
          setInputValue("");
        } else if (
          filtrdAllFileNames !== null &&
          activeDirName !== null &&
          filtrdAllFileNames.length === 1 &&
          filtrdOpenFiles.length === 0
        ) {
          const [name, setName] = createSignal<string>(
            filtrdAllFileNames[0].fullName,
          );
          const [content, setContent] = createSignal<string>("");
          getFileContent(activeDirName, filtrdAllFileNames[0].fullName).then(
            (content) => {
              if (content !== null) {
                setContent(content);
              } else {
                throw new Error("file not found");
              }
            },
          );
          setOpenFiles([
            ...openFiles(),
            { name, setName, content, setContent },
          ]);
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
) {
  const directoryNamesAndSize: { name: string; count: number }[] =
    await Promise.all(
      directoryNames().map(async (name) => {
        return { name, count: await countFilesInDirectory(name) };
      }),
    );
  let foundEmptyDirectory: string | null = null;
  for (const dns of directoryNamesAndSize) {
    if (dns.count === 0) {
      if (foundEmptyDirectory) {
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

export function onClickDownloadOpenFile(
  openFiles: Accessor<ReactiveFile[]>,
  name: string,
) {
  const openFile = openFiles().find((file) => file.name() === name);

  if (openFile) {
    const content = openFile.content();

    if (content !== null && content !== undefined) {
      const blob = new Blob([content], { type: "text/plain" });
      saveAs(blob, name);
    } else {
      console.error(`Content for file ${name} not found`);
    }
  } else {
    console.error(`Open file ${name} not found`);
  }
}

export function onClickUploadDirectory(
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
) {
  const input = document.createElement("input");
  input.type = "file";
  input.webkitdirectory = true;
  input.onchange = async (event) => {
    const files = (event.target as HTMLInputElement).files;

    if (!files) return;

    const directoryName = uuidv4();
    await addDirectory(directoryName);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.readAsText(file);
      reader.onload = async () => {
        const content = reader.result as string;
        await writeFileToDirectory(directoryName, {
          name: file.name,
          content,
        });
      };
    }

    onUpdateDirectory(directoryNames, setDirectoryNames).then();
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

export function onRenameOpenFile(
  oldName: string | null,
  newName: string | null,
  openFiles: Accessor<ReactiveFile[]>,
) {
  const fileWithSameNameAlreadyExists = openFiles().some(
    (of) => of.name() === newName,
  );

  if (fileWithSameNameAlreadyExists) return;

  const fileToRename: ReactiveFile | undefined = openFiles().find(
    (of) => of.name() === oldName,
  );
  if (fileToRename !== undefined && newName !== null) {
    fileToRename.setName(newName);
  }
  storeOpenFiles(openFiles);
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
