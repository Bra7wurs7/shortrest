import {
  Accessor,
  createMemo,
  createSignal,
  For,
  Match,
  Setter,
  Show,
  Signal,
  Switch,
  type JSXElement,
} from "solid-js";
import { AppMode } from "./types/appMode.enum";
import { BasicFile } from "./types/basicFile.interface";
import { ReactiveFile } from "./types/reactiveFile.interface";
import { loadOpenFiles } from "./functions/loadOpenFiles.function";
import { storeOpenFiles } from "./functions/storeOpenFiles.function";
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
import { v4 as uuidv4 } from "uuid";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { ConfirmAction } from "./types/confirmAction.enum";

export const localStorageOpenFilesKey = "openFiles";

function App(): JSXElement {
  // Signals
  const [appMode, setAppMode] = createSignal<AppMode>(AppMode.Editor);
  const [directoryNames, setDirectoryNames] = createSignal<string[]>([]);
  const [activeDirectoryName, setActiveDirectoryName] = createSignal<
    string | undefined
  >("");
  const [openFiles, setOpenFiles] =
    createSignal<ReactiveFile[]>(loadOpenFiles());
  const [activeFileName, setActiveFileName] = createSignal<
    string | undefined
  >();
  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<
    ConfirmAction | undefined
  >();
  const [rightClickedOpenFile, setRightClickedOpenFile] = createSignal<
    string | undefined
  >();
  const [rightClickedSavedFile, setRightClickedSavedFile] = createSignal<
    string | undefined
  >();
  const [rightClickedDirectory, setRightClickedDirectory] = createSignal<
    string | undefined
  >();

  // Memos
  const activeDirectoryFileNames = createMemo<Signal<string[]> | undefined>(
    () => {
      const activeDirName = activeDirectoryName();
      const signal: Signal<string[]> = createSignal<string[]>([]);
      if (activeDirName) {
        listFileNamesInDirectory(activeDirName).then((names) => {
          signal[1](names);
        });
        return signal;
      }
      return undefined;
    },
  );
  const filteredOpenFiles = createMemo<ReactiveFile[]>(() => {
    return openFiles().filter((of) =>
      of.name().toLowerCase().includes(inputValue().toLowerCase()),
    );
  });
  const filteredAllFileNames = createMemo<string[] | undefined>(() => {
    const activeDirFileNames = activeDirectoryFileNames();
    if (activeDirFileNames) {
      return activeDirFileNames[0]().filter((name: string) =>
        name.toLowerCase().includes(inputValue().toLowerCase()),
      );
    }
    return [];
  });
  const activeFile = createMemo<ReactiveFile | undefined>(() =>
    openFiles().find((of) => of.name() === activeFileName()),
  );

  // Initialization
  listAllDirectories().then((names) => {
    setDirectoryNames(names);
    onUpdateDirectory(directoryNames, setDirectoryNames).then();
  });

  return (
    <div id="APP_CONTAINER" class="dark_theme">
      <div id="LEFTMOST_SIDEBAR">
        <div id="LM_S_ACTIONS">
          <button
            onclick={() => {
              setAppMode(AppMode.Settings);
            }}
            class={
              "button_icon " + (appMode() === AppMode.Settings ? "active" : "")
            }
          >
            <i class={"bx bx-cog"}></i>
          </button>
          <button
            onclick={() => {
              setAppMode(AppMode.Assistant);
            }}
            class={
              "button_icon " + (appMode() === AppMode.Assistant ? "active" : "")
            }
          >
            <i class={"bx bx-conversation"}></i>
          </button>
          <button
            onclick={() => {
              setAppMode(AppMode.Editor);
            }}
            class={
              "button_icon " + (appMode() === AppMode.Editor ? "active" : "")
            }
          >
            <i class={"bx bx-file"}></i>
          </button>
          <button
            onclick={() => {
              setAppMode(AppMode.Donate);
            }}
            class={
              "button_icon " + (appMode() === AppMode.Donate ? "active" : "")
            }
          >
            <i class={"bx bx-donate-heart"}></i>
          </button>
        </div>
        <div id="LM_S_ARCHIVES">
          <button
            class={"button_icon"}
            onclick={(e) => {
              e.stopPropagation();
              onClickUploadDirectory(directoryNames, setDirectoryNames);
            }}
          >
            <i class="bx bx-upload"></i>
          </button>
          <For each={directoryNames()}>
            {(name: string, index: Accessor<number>) => (
              <Switch>
                <Match when={rightClickedDirectory() !== name}>
                  <button
                    class={
                      "button_icon " +
                      (name === activeDirectoryName() ? "active" : "")
                    }
                    onclick={() => {
                      setActiveDirectoryName(name);
                    }}
                    oncontextmenu={(e: PointerEvent) => {
                      e.preventDefault();
                      setRightClickedDirectory(name);
                    }}
                  >
                    <Show
                      when={name === activeDirectoryName() && index() === 0}
                    >
                      <i class="bx bx-folder-open"></i>
                    </Show>
                    <Show when={name === activeDirectoryName() && index() > 0}>
                      <i class="bx bxs-folder-open"></i>
                    </Show>
                    <Show
                      when={!(name === activeDirectoryName()) && index() > 0}
                    >
                      <i class="bx bxs-folder"></i>
                    </Show>
                    <Show
                      when={!(name === activeDirectoryName()) && index() === 0}
                    >
                      <i class="bx bx-folder-plus"></i>
                    </Show>
                  </button>
                </Match>
                <Match when={rightClickedDirectory() === name}>
                  <button
                    class={
                      "button_icon " +
                      (name === activeDirectoryName() ? "active" : "")
                    }
                    onclick={() => {
                      onClickDownloadDirectory(name);
                    }}
                    onmouseleave={() => {
                      setRightClickedDirectory("");
                    }}
                  >
                    <i class="bx bxs-download"></i>
                  </button>
                </Match>
              </Switch>
            )}
          </For>
        </div>
      </div>
      <input
        id="LEFT_INPUT"
        value={inputValue()}
        onkeyup={(e) => {
          onInputKeyUp(
            e,
            activeDirectoryName,
            setInputValue,
            openFiles,
            filteredOpenFiles,
            setOpenFiles,
            filteredAllFileNames,
            setActiveFileName,
          );
        }}
      ></input>
      <div id="LEFT_SIDEBAR">
        <div id="L_S_OPENFILES">
          <For each={filteredOpenFiles()}>
            {(file: ReactiveFile, index: Accessor<number>) => (
              <Switch>
                <Match when={rightClickedOpenFile() !== file.name()}>
                  <button
                    class={
                      "button_file " +
                      (activeFileName() === file.name() ? "active " : "") +
                      (rightClickedOpenFile() === file.name()
                        ? "context_menu"
                        : "")
                    }
                    onclick={() => {
                      setActiveFileName(file.name());
                    }}
                    oncontextmenu={(e: PointerEvent) => {
                      e.preventDefault();
                      setRightClickedOpenFile(file.name());
                    }}
                  >
                    <div class="filename">{file.name()}</div>
                    <div class="tags">#Tag1 #Tag2</div>
                  </button>
                </Match>
                <Match when={rightClickedOpenFile() === file.name()}>
                  <div
                    class="button_file_contextmenu"
                    onmouseleave={() => {
                      setRightClickedOpenFile(undefined);
                      setConfirmAction(undefined);
                    }}
                    onClick={() => {
                      setRightClickedOpenFile(undefined);
                    }}
                  >
                    <div class="filename">{file.name()}</div>
                    <div class="actions">
                      <button
                        class={"button_icon"}
                        onclick={(e) => {
                          e.stopPropagation();
                          onClickDownloadOpenFile(openFiles, file.name());
                        }}
                      >
                        <i class="bx bxs-download"></i>
                      </button>
                      <button
                        class={"button_icon"}
                        onclick={(e) => {
                          e.stopImmediatePropagation();
                          onClickSaveOpenFile(
                            index(),
                            openFiles,
                            directoryNames,
                            setDirectoryNames,
                            activeDirectoryFileNames,
                            activeDirectoryName,
                          );
                        }}
                      >
                        <i class="bx bx-save"></i>
                      </button>
                      <button
                        class={
                          "button_icon " +
                          (confirmAction() === ConfirmAction.DiscardChanges
                            ? "orange"
                            : "")
                        }
                        onclick={(e) => {
                          e.stopImmediatePropagation();
                          onClickCloseOpenFile(
                            index(),
                            openFiles,
                            activeDirectoryName,
                            setOpenFiles,
                            confirmAction,
                            setConfirmAction,
                          ).then();
                        }}
                      >
                        <i class="bx bx-x-circle"></i>
                      </button>
                    </div>
                  </div>
                </Match>
              </Switch>
            )}
          </For>
          <Show when={filteredOpenFiles().length > 0}>
            <div class="filelist_footer">
              <span></span>
              <span>Open Files</span>
            </div>
          </Show>
        </div>
        <div id="L_S_BOTTOM">
          <Show when={filteredAllFileNames() !== undefined}>
            <div id="L_S_B_ALLFILES">
              <Show when={filteredAllFileNames()!.length > 0}>
                <div class="filelist_header">
                  <span>Saved Files</span>
                </div>
              </Show>
              <For each={filteredAllFileNames()}>
                {(fileName: string, index: Accessor<number>) => (
                  <Switch>
                    <Match when={rightClickedSavedFile() !== fileName}>
                      <button
                        class={
                          "button_file " +
                          (rightClickedSavedFile() === fileName
                            ? "context_menu"
                            : "")
                        }
                        onclick={() => {
                          onClickSavedFile(
                            fileName,
                            activeDirectoryName,
                            openFiles,
                            setOpenFiles,
                          );
                        }}
                        oncontextmenu={(e: PointerEvent) => {
                          e.preventDefault();
                          setRightClickedSavedFile(fileName);
                        }}
                      >
                        <div class="filename">{fileName}</div>
                        <div class="tags">#Tag1 #Tag2</div>
                      </button>
                    </Match>
                    <Match when={rightClickedSavedFile() === fileName}>
                      <div
                        class="button_file_contextmenu"
                        onmouseleave={() => {
                          setRightClickedSavedFile(undefined);
                          setConfirmAction(undefined);
                        }}
                        onClick={() => {
                          setRightClickedSavedFile(undefined);
                        }}
                      >
                        <div class="filename">{fileName}</div>
                        <div class="actions">
                          <button
                            class={"button_icon"}
                            onclick={(e) => {
                              onClickDownloadSavedFile(
                                activeDirectoryName,
                                fileName,
                              );
                              e.stopPropagation();
                            }}
                          >
                            <i class="bx bxs-download"></i>
                          </button>
                          <button
                            class={
                              "button_icon " +
                              (confirmAction() === ConfirmAction.TrashFile
                                ? "red"
                                : "")
                            }
                            onclick={(e) => {
                              e.stopPropagation();
                              onClickTrashSavedFile(
                                fileName,
                                activeDirectoryName,
                                activeDirectoryFileNames,
                                directoryNames,
                                setDirectoryNames,
                                confirmAction,
                                setConfirmAction,
                              ).then();
                            }}
                          >
                            <i class="bx bxs-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    </Match>
                  </Switch>
                )}
              </For>
            </div>
          </Show>

          <div id="L_S_B_TOOLTIP"></div>
        </div>
      </div>
      <Switch>
        <Match when={appMode() === AppMode.Settings}>
          <div id="SETTINGS_WINDOW"></div>
          <div id="SETTINGS_CATEGORIES"></div>
        </Match>
        <Match when={appMode() === AppMode.Assistant}>
          <div id="ASSISTANT_HISTORY">
            <div class="message system">
              You are a philosopher and a great mind. You also give excellent
              financial advice.
            </div>
            <div class="message ours">
              Hey AI! How's it going? I've got some spare money that I wanna
              multiply. Do you think it would be smart to invest in Microsoft?
            </div>
            <div class="message theirs">
              Only if you wanna strengthen an already too powerful and
              apparently evil monopoly my bro!
            </div>
          </div>
          <input id="ASSISTANT_PROMPT_INPUT"></input>
          <div id="ASSISTANT_TOOLBAR"></div>
        </Match>
        <Match when={appMode() === AppMode.Editor}>
          <textarea
            id="EDITOR_TEXTAREA"
            value={
              activeFile()?.content() ??
              "Please open a file to start editing its contents"
            }
            onChange={(e) => {
              onEditorChange(
                e,
                activeFile()?.content,
                activeFile()?.setContent,
                openFiles,
              );
            }}
          ></textarea>
          <div id="EDITOR_TOOLBAR"></div>
        </Match>
        <Match when={appMode() === AppMode.Donate}>
          <div id="DONATE_MESSAGE"></div>
        </Match>
      </Switch>
    </div>
  );
}

function onClickSavedFile(
  fileName: string,
  activeDirectoryName: Accessor<string | undefined>,
  openFiles: Accessor<ReactiveFile[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
) {
  const fileIndexInOpenFiles = openFiles().findIndex(
    (f) => f.name() === fileName,
  );

  if (fileIndexInOpenFiles === -1) {
    const [name, setName] = createSignal<string>(fileName);
    const [content, setContent] = createSignal<string>("");
    const activeDirName = activeDirectoryName();
    if (activeDirName !== undefined) {
      getFileContent(activeDirName, fileName).then((content) => {
        if (content !== null) {
          setContent(content);
        } else {
          throw new Error("file not found");
        }
      });
      setOpenFiles([...openFiles(), { name, setName, content, setContent }]);
      storeOpenFiles(openFiles);
    }
  }
}

function onEditorChange(
  event: Event & {
    currentTarget: HTMLTextAreaElement;
    target: HTMLTextAreaElement;
  },
  accessor: Accessor<string> | undefined,
  setter: Setter<string> | undefined,
  openFiles: Accessor<ReactiveFile[]>,
) {
  if (accessor && setter) {
    const fileContent = accessor();
    setter(event.target?.value);
    storeOpenFiles(openFiles);
  }
}

async function onClickCloseOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  activeDirectoryName: Accessor<string | undefined>,
  setOpenFiles: Setter<ReactiveFile[]>,
  confirmAction: Accessor<ConfirmAction | undefined>,
  setConfirmAction: Setter<ConfirmAction | undefined>,
) {
  const currentOpenFiles = openFiles();
  const openFile = currentOpenFiles[index];
  const activeDirName = activeDirectoryName();

  if (openFile) {
    const savedFileContent =
      activeDirName !== undefined
        ? await getFileContent(activeDirName, openFile.name())
        : null;

    const changesExist =
      savedFileContent !== null && savedFileContent !== openFile.content();

    if (savedFileContent === null || changesExist) {
      // Require confirmation for unsaved changes or non-existent saved file
      if (confirmAction() === ConfirmAction.DiscardChanges) {
        currentOpenFiles.splice(index, 1);
        setOpenFiles([...currentOpenFiles]);
        setConfirmAction(undefined);
      } else {
        setConfirmAction(ConfirmAction.DiscardChanges);
      }
    } else {
      // No confirmation needed for saved changes
      currentOpenFiles.splice(index, 1);
      setOpenFiles([...currentOpenFiles]);
      setConfirmAction(undefined);
    }

    storeOpenFiles(openFiles);
  }
}

function onClickSaveOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryFileNames: Accessor<Signal<string[]> | undefined>,
  activeDirectoryName: Accessor<string | undefined>,
) {
  const openFile: ReactiveFile | undefined = openFiles()[index];
  const activeDirName: string | undefined = activeDirectoryName();
  const activeDirFileNames: Signal<string[]> | undefined =
    activeDirectoryFileNames();

  if (openFile && activeDirName && activeDirFileNames) {
    writeFileToDirectory(activeDirName, {
      name: openFile.name(),
      content: openFile.content(),
    }).then(() => {
      if (!activeDirFileNames[0]().includes(openFile.name()))
        activeDirFileNames[1]([...activeDirFileNames[0](), openFile.name()]);
      onUpdateDirectory(directoryNames, setDirectoryNames).then();
    });
  }
}

/** @TODO Put deleted files into a "trash" directory instead of deleting them outright */
async function onClickTrashSavedFile(
  name: string,
  activeDirectoryName: Accessor<string | undefined>,
  activeDirectoryFileNames: Accessor<Signal<string[]> | undefined>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  confirmAction: Accessor<ConfirmAction | undefined>,
  setConfirmAction: Setter<ConfirmAction | undefined>,
) {
  const activeDirName = activeDirectoryName();
  const activeDirFileNames = activeDirectoryFileNames();

  if (
    confirmAction() === ConfirmAction.TrashFile &&
    activeDirName !== undefined &&
    activeDirFileNames !== undefined
  ) {
    await removeFileFromDirectory(activeDirName, name);
    activeDirFileNames[1](await listFileNamesInDirectory(activeDirName));
    await onUpdateDirectory(directoryNames, setDirectoryNames);
    setConfirmAction(undefined);
  } else {
    setConfirmAction(ConfirmAction.TrashFile);
  }
}

function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  activeDirectoryName: Accessor<string | undefined>,
  setInputValue: Setter<string>,
  openFiles: Accessor<ReactiveFile[]>,
  filteredOpenFiles: Accessor<ReactiveFile[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
  filteredAllFileNames: Accessor<string[] | undefined>,
  setActiveFile: Setter<string | undefined>,
) {
  const filtrdAllFileNames = filteredAllFileNames();
  const filtrdOpenFiles = filteredOpenFiles();
  const activeDirName = activeDirectoryName();

  setInputValue(e.currentTarget.value);
  switch (e.key) {
    case "Enter":
      if (e.ctrlKey) {
        const [name, setName] = createSignal<string>(e.currentTarget.value);
        const [content, setContent] = createSignal<string>("");
        setOpenFiles([...openFiles(), { name, setName, content, setContent }]);
        setActiveFile(name);
        setInputValue("");
        storeOpenFiles(openFiles);
      } else {
        if ((filtrdOpenFiles.length = 1)) {
          setActiveFile(filtrdOpenFiles[0].name);
          setInputValue("");
        } else if (
          filtrdAllFileNames !== undefined &&
          activeDirName !== undefined &&
          (filtrdAllFileNames.length = 1 && (filtrdOpenFiles.length = 0))
        ) {
          const [name, setName] = createSignal<string>(filtrdAllFileNames[0]);
          const [content, setContent] = createSignal<string>(
            filtrdAllFileNames[0],
          );
          getFileContent(activeDirName, filtrdAllFileNames[0]).then(
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

async function onUpdateDirectory(
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
) {
  const directoryNamesAndSize: { name: string; count: number }[] =
    await Promise.all(
      directoryNames().map(async (name) => {
        return { name, count: await countFilesInDirectory(name) };
      }),
    );
  let foundEmptyDirectory: string | undefined = undefined;
  for (const dns of directoryNamesAndSize) {
    if (dns.count === 0) {
      if (foundEmptyDirectory) {
        await removeDirectory(dns.name);
      } else {
        foundEmptyDirectory = dns.name;
      }
    }
  }
  if (foundEmptyDirectory === undefined) {
    await addDirectory(uuidv4());
  }
  setDirectoryNames(await listAllDirectories());
}

function onClickDownloadSavedFile(
  activeDirectoryName: Accessor<string | undefined>,
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

function onClickDownloadOpenFile(
  openFiles: Accessor<ReactiveFile[]>,
  name: string,
) {
  const openFile = openFiles().find((file) => file.name() === name);

  if (openFile) {
    // Get content from the open file's signal
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

function onClickUploadDirectory(
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
) {
  const input = document.createElement("input");
  input.type = "file";
  input.webkitdirectory = true;
  input.onchange = async (event) => {
    const files = (event.target as HTMLInputElement).files;

    if (!files) return;

    // Create a new directory in the IDB
    const directoryName = uuidv4();
    await addDirectory(directoryName);

    // Upload each file to the new directory
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

function onClickDownloadDirectory(name: string) {
  // Get all file names in the directory
  listFileNamesInDirectory(name)
    .then((fileNames) => {
      if (fileNames.length === 0) {
        console.warn(`No files found in directory ${name}`);
        return;
      }

      // Create a ZIP archive with all files from the directory
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
          // Download the ZIP archive
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

export default App;
