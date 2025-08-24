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
import { DOMElement } from "solid-js/jsx-runtime";
import { loadOpenFiles } from "./functions/loadOpenFiles.function";
import { storeOpenFiles } from "./functions/storeOpenFiles.function";
import { Directory } from "./types/directory.interface";
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

export const localStorageOpenFilesKey = "openFiles";

function App(): JSXElement {
  const [appMode, setAppMode] = createSignal<AppMode>(AppMode.Editor);
  /** List of the names of all directories stored in the IDB */
  const [directoryNames, setDirectoryNames] = createSignal<string[]>([]);
  /** The name of the currently viewed directory */
  const [activeDirectoryName, setActiveDirectoryName] =
    createSignal<string>("");
  const [openFiles, setOpenFiles] =
    createSignal<ReactiveFile[]>(loadOpenFiles());
  const [activeFile, setActiveFile] = createSignal<number>(0);
  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<string>("");
  const [rightClickedOpenFile, setRightClickedOpenFile] =
    createSignal<string>("");
  const [rightClickedSavedFile, setRightClickedSavedFile] =
    createSignal<string>("");

  const activeDirectoryFileNames = createMemo<Signal<string[]>>(() => {
    const signal: Signal<string[]> = createSignal<string[]>([]);
    listFileNamesInDirectory(activeDirectoryName()).then((names) => {
      return signal[1](names);
    });
    return signal;
  });
  const filteredOpenFiles = createMemo<ReactiveFile[]>(() => {
    return openFiles().filter((of) =>
      of.name().toLowerCase().includes(inputValue().toLowerCase()),
    );
  });
  const filteredAllFileNames = createMemo<string[]>(() => {
    return activeDirectoryFileNames()[0]().filter(
      (name: string | undefined) => {
        if (name !== undefined)
          return name.toLowerCase().includes(inputValue().toLowerCase());
      },
    );
  });

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
          <button class={"button_icon"}>
            <i class="bx bx-upload"></i>
          </button>
          <For each={directoryNames()}>
            {(name: string, index: Accessor<number>) => (
              <button
                class={
                  "button_icon " +
                  (name === activeDirectoryName() ? "active" : "")
                }
                onclick={() => {
                  setActiveDirectoryName(name);
                }}
              >
                <Show when={name === activeDirectoryName() && index() === 0}>
                  <i class="bx bx-folder-open"></i>
                </Show>
                <Show when={name === activeDirectoryName() && index() > 0}>
                  <i class="bx bxs-folder-open"></i>
                </Show>
                <Show when={!(name === activeDirectoryName()) && index() > 0}>
                  <i class="bx bxs-folder"></i>
                </Show>
                <Show when={!(name === activeDirectoryName()) && index() === 0}>
                  <i class="bx bx-folder-plus"></i>
                </Show>
              </button>
            )}
          </For>
          <button class={"button_icon"}>
            <i class="bx bx-trash-alt"></i>
          </button>
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
            setActiveFile,
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
                      (activeFile() === index() ? "active " : "") +
                      (rightClickedOpenFile() === file.name()
                        ? "context_menu"
                        : "")
                    }
                    onclick={() => {
                      onClickOpenFile(index(), setActiveFile);
                    }}
                    oncontextmenu={(e: PointerEvent) =>
                      onFileRightclick(e, file.name(), setRightClickedOpenFile)
                    }
                  >
                    <div class="filename">{file.name()}</div>
                    <div class="tags">#Tag1 #Tag2</div>
                  </button>
                </Match>
                <Match when={rightClickedOpenFile() === file.name()}>
                  <div
                    class="button_file_contextmenu"
                    onmouseleave={() => {
                      onMouseLeaveFile(setRightClickedOpenFile);
                      setConfirmAction("");
                    }}
                    onClick={() => {
                      setRightClickedOpenFile("");
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
                        <i class="bx bx-download"></i>
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
                            setActiveDirectoryName,
                          );
                        }}
                      >
                        <i class="bx bx-save"></i>
                      </button>
                      <button
                        class={
                          "button_icon " +
                          (confirmAction() === "discardChanges" ? "red" : "")
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
          <div id="L_S_B_ALLFILES">
            <Show when={filteredAllFileNames().length > 0}>
              <div class="filelist_header">
                <span></span>
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
                      oncontextmenu={(e: PointerEvent) =>
                        onFileRightclick(e, fileName, setRightClickedSavedFile)
                      }
                    >
                      <div class="filename">{fileName}</div>
                      <div class="tags">#Tag1 #Tag2</div>
                    </button>
                  </Match>
                  <Match when={rightClickedSavedFile() === fileName}>
                    <div
                      class="button_file_contextmenu"
                      onmouseleave={() => {
                        onMouseLeaveFile(setRightClickedSavedFile);
                        setConfirmAction("");
                      }}
                      onClick={() => {
                        setRightClickedSavedFile("");
                      }}
                    >
                      <div class="filename">{fileName}</div>
                      <div class="actions">
                        <button
                          class={
                            "button_icon " +
                            (confirmAction() === "saveOpenFile" ? "orange" : "")
                          }
                          onclick={(e) => {
                            onClickDownloadSavedFile(
                              activeDirectoryName,
                              fileName,
                            );
                            e.stopImmediatePropagation();
                          }}
                        >
                          <i class="bx bx-download"></i>
                        </button>
                        <button
                          class={
                            "button_icon " +
                            (confirmAction() === "trashFile" ? "red" : "")
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
            value={openFiles()[activeFile()]?.content() ?? ""}
            onChange={(e) => {
              onEditorChange(
                e,
                openFiles()[activeFile()].content,
                openFiles()[activeFile()].setContent,
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

function onClickOpenFile(fileIndex: number, setter: Setter<number>) {
  setter(fileIndex);
}

function onMouseLeaveFile(setter: Setter<string>) {
  setter("");
}

function onClickSavedFile(
  fileName: string,
  activeDirectoryName: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
) {
  const fileIndexInOpenFiles = openFiles().findIndex(
    (f) => f.name() === fileName,
  );

  if (fileIndexInOpenFiles === -1) {
    const [name, setName] = createSignal<string>(fileName);
    const [content, setContent] = createSignal<string>("");
    getFileContent(activeDirectoryName(), fileName).then((content) => {
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

function onFileRightclick(
  e: PointerEvent,
  name: string,
  setter: Setter<string> | undefined,
) {
  e.preventDefault();
  if (setter) setter(name);
}

async function onClickCloseOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  activeDirectoryName: Accessor<string>,
  setOpenFiles: Setter<ReactiveFile[]>,
  confirmAction: Accessor<string>,
  setConfirmAction: Setter<string>,
) {
  let currentOpenFiles = openFiles();
  let openFile = currentOpenFiles[index];

  if (openFile) {
    const savedFileContent = await getFileContent(
      activeDirectoryName(),
      openFile.name(),
    );

    const changesExist =
      savedFileContent !== null && savedFileContent !== openFile.content();

    if (savedFileContent === null || changesExist) {
      // Require confirmation for unsaved changes or non-existent saved file
      if (confirmAction() === "discardChanges") {
        currentOpenFiles.splice(index, 1);
        setOpenFiles([...currentOpenFiles]);
        setConfirmAction("");
      } else {
        setConfirmAction("discardChanges");
      }
    } else {
      // No confirmation needed for saved changes
      currentOpenFiles.splice(index, 1);
      setOpenFiles([...currentOpenFiles]);
      setConfirmAction("");
    }
  }
}

function onClickSaveOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryFileNames: Accessor<Signal<string[]>>,
  activeDirectoryName: Accessor<string>,
  setActiveDirectoryName: Setter<string>,
) {
  let openFile: ReactiveFile | undefined = openFiles()[index];

  if (openFile) {
    writeFileToDirectory(activeDirectoryName(), {
      name: openFile.name(),
      content: openFile.content(),
    }).then(() => {
      if (!activeDirectoryFileNames()[0]().includes(openFile.name()))
        activeDirectoryFileNames()[1]([
          ...activeDirectoryFileNames()[0](),
          openFile.name(),
        ]);
      onUpdateDirectory(directoryNames, setDirectoryNames).then();
    });
  }
}

async function onClickTrashSavedFile(
  name: string,
  activeDirectoryName: Accessor<string>,
  activeDirectoryFileNames: Accessor<Signal<string[]>>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  confirmAction: Accessor<string>,
  setConfirmAction: Setter<string>,
) {
  if (confirmAction() === "trashFile") {
    await removeFileFromDirectory(activeDirectoryName(), name);
    activeDirectoryFileNames()[1](
      await listFileNamesInDirectory(activeDirectoryName()),
    );
    await onUpdateDirectory(directoryNames, setDirectoryNames);
    setConfirmAction("");
  } else {
    setConfirmAction("trashFile");
  }
}

function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  activeDirectoryName: Accessor<string>,
  inputSetter: Setter<string>,
  openFilesAccessor: Accessor<ReactiveFile[]>,
  filteredOpenFilesAccessor: Accessor<ReactiveFile[]>,
  openFilesSetter: Setter<ReactiveFile[]>,
  filteredAllFileNames: Accessor<string[]>,
  activeFileSetter: Setter<number>,
) {
  inputSetter(e.currentTarget.value);
  switch (e.key) {
    case "Enter":
      if (e.ctrlKey) {
        const [name, setName] = createSignal<string>(e.currentTarget.value);
        const [content, setContent] = createSignal<string>("");
        openFilesSetter([
          ...openFilesAccessor(),
          { name, setName, content, setContent },
        ]);
        activeFileSetter(openFilesAccessor().length - 1);
        inputSetter("");
        storeOpenFiles(openFilesAccessor);
      } else {
        if ((filteredOpenFilesAccessor().length = 1)) {
          activeFileSetter(
            openFilesAccessor().findIndex(
              (of) => of.name === filteredOpenFilesAccessor()[0].name,
            ),
          );
          inputSetter("");
        } else if (
          (filteredAllFileNames().length =
            1 && (filteredOpenFilesAccessor().length = 0))
        ) {
          const [name, setName] = createSignal<string>(
            filteredAllFileNames()[0],
          );
          const [content, setContent] = createSignal<string>(
            filteredAllFileNames()[0],
          );
          getFileContent(activeDirectoryName(), filteredAllFileNames()[0]).then(
            (content) => {
              if (content !== null) {
                setContent(content);
              } else {
                throw new Error("file not found");
              }
            },
          );
          openFilesSetter([
            ...openFilesAccessor(),
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
  activeDirectoryName: Accessor<string>,
  name: string,
) {
  // Get file content from the active directory
  getFileContent(activeDirectoryName(), name)
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

async function onClickUploadFile() {}

export default App;
