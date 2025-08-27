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
import { parseFileName } from "./functions/parseFileName.function";
import { ParsedFileName } from "./types/parsedFileName.interface";

export const localStorageOpenFilesKey = "openFiles";

function App(): JSXElement {
  // Signals
  const [appMode, setAppMode] = createSignal<AppMode>(AppMode.Editor);
  const [directoryNames, setDirectoryNames] = createSignal<string[]>([]);
  const [activeDirectoryName, setActiveDirectoryName] = createSignal<
    string | null
  >(null);
  const [openFiles, setOpenFiles] =
    createSignal<ReactiveFile[]>(loadOpenFiles());
  const [activeFileName, setActiveFileName] = createSignal<string | null>(null);
  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(
    null,
  );
  const [rightClickedOpenFile, setRightClickedOpenFile] = createSignal<
    string | null
  >(null);
  const [rightClickedSavedFile, setRightClickedSavedFile] = createSignal<
    string | null
  >(null);
  const [rightClickedDirectory, setRightClickedDirectory] = createSignal<
    string | null
  >(null);
  const [hoveredDirectoryName, setHoveredDirectoryName] = createSignal<
    string | null
  >(null);

  // Memos
  const activeDirectoryFileNames = createMemo<Signal<string[]> | null>(() => {
    const activeDirName = activeDirectoryName();
    const signal: Signal<string[]> = createSignal<string[]>([]);
    if (activeDirName) {
      listFileNamesInDirectory(activeDirName).then((names) => {
        signal[1](names);
      });
      return signal;
    }
    return null;
  });
  const filteredParsedOpenFileNames = createMemo<ParsedFileName[]>(() => {
    return openFiles()
      .filter((of) =>
        of.name().toLowerCase().includes(inputValue().toLowerCase()),
      )
      .map((of) => parseFileName(of.name()));
  });
  const filteredParsedAllFileNames = createMemo<ParsedFileName[] | null>(() => {
    const activeDirFileNames = activeDirectoryFileNames();
    if (activeDirFileNames) {
      return activeDirFileNames[0]()
        .filter((name: string) =>
          name.toLowerCase().includes(inputValue().toLowerCase()),
        )
        .map((name) => parseFileName(name));
    }
    return null;
  });
  const activeFile = createMemo<ReactiveFile | null>(
    () => openFiles().find((of) => of.name() === activeFileName()) ?? null,
  );
  const hoveredDirectoryFileNames = createMemo<Signal<ParsedFileName[]> | null>(
    () => {
      const hoveredDirName = hoveredDirectoryName();
      const signal: Signal<ParsedFileName[]> = createSignal<ParsedFileName[]>(
        [],
      );
      if (hoveredDirName) {
        listFileNamesInDirectory(hoveredDirName).then((names) => {
          signal[1](names.map((name) => parseFileName(name)));
        });
        return signal;
      }
      return null;
    },
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
        <div id="LM_S_BOTTOM">
          <button
            class={"button_icon"}
            onclick={(e) => {
              e.stopPropagation();
              onClickUploadDirectory(directoryNames, setDirectoryNames);
            }}
          >
            <i class="bx bx-upload"></i>
          </button>
          <div id="LM_S_DIRECTORIES">
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
                      onmouseenter={() => {
                        setHoveredDirectoryName(name);
                      }}
                      onmouseleave={() => {
                        setHoveredDirectoryName(null);
                      }}
                    >
                      <Show
                        when={name === activeDirectoryName() && index() === 0}
                      >
                        <i class="bx bx-folder-open"></i>
                      </Show>
                      <Show
                        when={name === activeDirectoryName() && index() > 0}
                      >
                        <i class="bx bxs-folder-open"></i>
                      </Show>
                      <Show
                        when={!(name === activeDirectoryName()) && index() > 0}
                      >
                        <i class="bx bxs-folder"></i>
                      </Show>
                      <Show
                        when={
                          !(name === activeDirectoryName()) && index() === 0
                        }
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
            filteredParsedOpenFileNames,
            setOpenFiles,
            filteredParsedAllFileNames,
            setActiveFileName,
          );
        }}
      ></input>
      <div id="LEFT_SIDEBAR">
        <div id="L_S_TOP">
          <div id="L_S_OPENFILES">
            <For each={filteredParsedOpenFileNames()}>
              {(parsedName: ParsedFileName, index: Accessor<number>) => (
                <Switch>
                  <Match when={rightClickedOpenFile() !== parsedName.name}>
                    <button
                      class={
                        "button_file " +
                        (activeFileName() === parsedName.name
                          ? "active "
                          : "") +
                        (rightClickedOpenFile() === parsedName.name
                          ? "context_menu"
                          : "")
                      }
                      onclick={() => {
                        setActiveFileName(parsedName.name);
                      }}
                      oncontextmenu={(e: PointerEvent) => {
                        e.preventDefault();
                        setRightClickedOpenFile(parsedName.name);
                      }}
                    >
                      <div class="filename">{parsedName.baseName}</div>
                      <div class="tags">
                        <For each={parsedName.tags}>
                          {(tag: string) => <span>#{tag}&nbsp;</span>}
                        </For>
                      </div>
                    </button>
                  </Match>
                  <Match when={rightClickedOpenFile() === parsedName.name}>
                    <div
                      class="button_file_contextmenu"
                      onmouseleave={() => {
                        setRightClickedOpenFile(null);
                        setConfirmAction(null);
                      }}
                      onClick={() => {
                        setRightClickedOpenFile(null);
                      }}
                    >
                      <div class="filename">{parsedName.name}</div>
                      <div class="actions">
                        <button
                          class={"button_icon"}
                          onclick={(e) => {
                            e.stopPropagation();
                            onClickDownloadOpenFile(openFiles, parsedName.name);
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
          </div>
          <Show when={filteredParsedOpenFileNames().length > 0}>
            <div class="filelist_footer">
              <span>Open Files</span>
              <i class="bx bx-edit-alt"></i>
            </div>
          </Show>
        </div>
        <div id="L_S_BOTTOM">
          <Show
            when={
              hoveredDirectoryFileNames()
                ? hoveredDirectoryFileNames()![0]().length > 0
                : filteredParsedAllFileNames() &&
                  filteredParsedAllFileNames()!.length > 0
            }
          >
            <div class="filelist_header">
              <i class="bx bx-folder"></i>
              <span>Directory</span>
            </div>
          </Show>
          <Show
            when={
              hoveredDirectoryFileNames() ||
              filteredParsedAllFileNames() !== null
            }
          >
            <div id="L_S_B_ALLFILES">
              <For
                each={
                  hoveredDirectoryFileNames()
                    ? hoveredDirectoryFileNames()![0]()
                    : filteredParsedAllFileNames()
                }
              >
                {(parsedName: ParsedFileName, index: Accessor<number>) => (
                  <Switch>
                    <Match when={rightClickedSavedFile() !== parsedName.name}>
                      <button
                        class={
                          "button_file " +
                          (rightClickedSavedFile() === parsedName.name
                            ? "context_menu"
                            : "")
                        }
                        onclick={() => {
                          onClickSavedFile(
                            parsedName.name,
                            activeDirectoryName,
                            openFiles,
                            setOpenFiles,
                          );
                        }}
                        oncontextmenu={(e: PointerEvent) => {
                          e.preventDefault();
                          setRightClickedSavedFile(parsedName.name);
                        }}
                      >
                        <div class="filename">{parsedName.baseName}</div>
                        <div class="tags">
                          <For each={parsedName.tags}>
                            {(tag: string) => <span>#{tag}</span>}
                          </For>
                        </div>
                      </button>
                    </Match>
                    <Match when={rightClickedSavedFile() === parsedName.name}>
                      <div
                        class="button_file_contextmenu"
                        onmouseleave={() => {
                          setRightClickedSavedFile(null);
                          setConfirmAction(null);
                        }}
                        onClick={() => {
                          setRightClickedSavedFile(null);
                        }}
                      >
                        <div class="filename">{parsedName.baseName}</div>
                        <div class="actions">
                          <button
                            class={"button_icon"}
                            onclick={(e) => {
                              onClickDownloadSavedFile(
                                activeDirectoryName,
                                parsedName.name,
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
                                parsedName.name,
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
                activeFile()?.content ?? null,
                activeFile()?.setContent ?? null,
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
  activeDirectoryName: Accessor<string | null>,
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
    if (activeDirName !== null) {
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
  accessor: Accessor<string> | null,
  setter: Setter<string> | null,
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
  activeDirectoryName: Accessor<string | null>,
  setOpenFiles: Setter<ReactiveFile[]>,
  confirmAction: Accessor<ConfirmAction | null>,
  setConfirmAction: Setter<ConfirmAction | null>,
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
      // Require confirmation for unsaved changes or non-existent saved file
      if (confirmAction() === ConfirmAction.DiscardChanges) {
        currentOpenFiles.splice(index, 1);
        setOpenFiles([...currentOpenFiles]);
        setConfirmAction(null);
      } else {
        setConfirmAction(ConfirmAction.DiscardChanges);
      }
    } else {
      // No confirmation needed for saved changes
      currentOpenFiles.splice(index, 1);
      setOpenFiles([...currentOpenFiles]);
      setConfirmAction(null);
    }

    storeOpenFiles(openFiles);
  }
}

function onClickSaveOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  activeDirectoryFileNames: Accessor<Signal<string[]> | null>,
  activeDirectoryName: Accessor<string | null>,
) {
  const openFile: ReactiveFile | null = openFiles()[index];
  const activeDirName: string | null = activeDirectoryName();
  const activeDirFileNames: Signal<string[]> | null =
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
  activeDirectoryName: Accessor<string | null>,
  activeDirectoryFileNames: Accessor<Signal<string[]> | null>,
  directoryNames: Accessor<string[]>,
  setDirectoryNames: Setter<string[]>,
  confirmAction: Accessor<ConfirmAction | null>,
  setConfirmAction: Setter<ConfirmAction | null>,
) {
  const activeDirName = activeDirectoryName();
  const activeDirFileNames = activeDirectoryFileNames();

  if (
    confirmAction() === ConfirmAction.TrashFile &&
    activeDirName !== null &&
    activeDirFileNames !== null
  ) {
    await removeFileFromDirectory(activeDirName, name);
    activeDirFileNames[1](await listFileNamesInDirectory(activeDirName));
    await onUpdateDirectory(directoryNames, setDirectoryNames);
    setConfirmAction(null);
  } else {
    setConfirmAction(ConfirmAction.TrashFile);
  }
}

function onInputKeyUp(
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
          filtrdAllFileNames !== null &&
          activeDirName !== null &&
          (filtrdAllFileNames.length = 1 && (filtrdOpenFiles.length = 0))
        ) {
          const [name, setName] = createSignal<string>(
            filtrdAllFileNames[0].name,
          );
          const [content, setContent] = createSignal<string>("");
          getFileContent(activeDirName, filtrdAllFileNames[0].name).then(
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

function onClickDownloadSavedFile(
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
