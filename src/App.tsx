import {
  Accessor,
  createMemo,
  createSignal,
  For,
  Match,
  Setter,
  Show,
  Switch,
  type JSXElement,
} from "solid-js";
import { Message } from "ollama";
import { parseFile } from "./functions/parseFile.function";
import { AppMode } from "./types/appMode.enum";
import { BasicFile } from "./types/basicFile.interface";
import { ReactiveFile } from "./types/reactiveFile.interface";
import { DOMElement } from "solid-js/jsx-runtime";
import { loadOpenFiles } from "./functions/loadOpenFiles.function";
import { loadArchive } from "./functions/loadArchive.function";
import { storeOpenFiles } from "./functions/storeOpenFiles.function";
import { IDBPDatabase, openDB } from "idb";

export const localStorageOpenFilesKey = "openFiles";

function App(): JSXElement {
  const [appMode, setAppMode] = createSignal<AppMode>(AppMode.Editor);
  const [directories, setDirectories] = createSignal<BasicFile[][]>([]);
  const [directoryIndex, setDirectoryIndex] = createSignal<number>(-1);
  const [directory, setDirectory] = createSignal<BasicFile[]>(loadArchive(""));
  const [openFiles, setOpenFiles] =
    createSignal<ReactiveFile[]>(loadOpenFiles());
  const [activeFile, setActiveFile] = createSignal<number>(0);
  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<string>("");
  const [rightClickedOpenFile, setRightClickedOpenFile] =
    createSignal<string>("");
  const [rightClickedSavedFile, setRightClickedSavedFile] =
    createSignal<string>("");
  const [assistantHistory, setAssistantHistory] = createSignal<Message[]>([]);

  const filteredOpenFiles = createMemo<ReactiveFile[]>(() => {
    return openFiles().filter((of) =>
      of.name().toLowerCase().includes(inputValue().toLowerCase()),
    );
  });
  const filteredAllFiles = createMemo<BasicFile[]>(() => {
    return directory().filter((af) =>
      af.name.toLowerCase().includes(inputValue().toLowerCase()),
    );
  });

  const indexedDatabase: Promise<IDBPDatabase<unknown>> = openDB(
    "directoriesDb",
    1,
    {
      upgrade(db) {
        db.createObjectStore("directories");
      },
    },
  );

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
          <button class={"button_icon"}>
            <i class="bx bxs-folder-plus"></i>
          </button>
          <For each={directories()}>
            {(directory: BasicFile[], index: Accessor<number>) => (
              <button
                class={
                  "button_icon " +
                  (index() === directoryIndex() ? "active" : "")
                }
              >
                <Show when={index() === directoryIndex()}>
                  <i class="bx bxs-folder-open"></i>
                </Show>
                <Show when={!(index() === directoryIndex())}>
                  <i class="bx bxs-folder"></i>
                </Show>
              </button>
            )}
          </For>
          <button class={"button_icon"}>
            <i class="bx bxs-trash-alt"></i>
          </button>
        </div>
      </div>
      <input
        id="LEFT_INPUT"
        value={inputValue()}
        onkeyup={(e) => {
          onInputKeyUp(
            e,
            setInputValue,
            openFiles,
            filteredOpenFiles,
            setOpenFiles,
            filteredAllFiles,
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
                      <button class={"button_icon"}>
                        <i class="bx bx-download"></i>
                      </button>
                      <button
                        class={"button_icon"}
                        onclick={(e) => {
                          e.stopImmediatePropagation();
                          onClickSaveOpenFile(
                            index(),
                            openFiles,
                            directory,
                            setDirectory,
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
                            directory,
                            setOpenFiles,
                            confirmAction,
                            setConfirmAction,
                          );
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
            <Show when={filteredAllFiles().length > 0}>
              <div class="filelist_header">
                <span></span>
                <span>Saved Files</span>
              </div>
            </Show>
            <For each={filteredAllFiles()}>
              {(file: BasicFile, index: Accessor<number>) => (
                <Switch>
                  <Match when={rightClickedSavedFile() !== file.name}>
                    <button
                      class={
                        "button_file " +
                        (rightClickedSavedFile() === file.name
                          ? "context_menu"
                          : "")
                      }
                      onclick={() => {
                        onClickSavedFile(file, openFiles, setOpenFiles);
                      }}
                      oncontextmenu={(e: PointerEvent) =>
                        onFileRightclick(e, file.name, setRightClickedSavedFile)
                      }
                    >
                      <div class="filename">{file.name}</div>
                      <div class="tags">#Tag1 #Tag2</div>
                    </button>
                  </Match>
                  <Match when={rightClickedSavedFile() === file.name}>
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
                      <div class="filename">{file.name}</div>
                      <div class="actions">
                        <button
                          class={
                            "button_icon " +
                            (confirmAction() === "saveOpenFile" ? "orange" : "")
                          }
                          onclick={(e) => {
                            e.stopImmediatePropagation();
                          }}
                        >
                          <i class="bx bx-download"></i>
                        </button>
                        <button
                          class={
                            "button_icon " +
                            (confirmAction() === "discardChanges"
                              ? "orange"
                              : "")
                          }
                        >
                          <i class="bx bx-trash-alt"></i>
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
  file: BasicFile,
  accessor: Accessor<ReactiveFile[]>,
  setter: Setter<ReactiveFile[]>,
) {
  const openFiles = accessor();
  const fileIndexInOpenFiles = openFiles.findIndex(
    (f) => f.name() === file.name,
  );
  if (fileIndexInOpenFiles === -1) {
    const [name, setName] = createSignal<string>(file.name);
    const [content, setContent] = createSignal<string>(file.content);
    setter([...openFiles, { name, setName, content, setContent }]);
    storeOpenFiles(accessor);
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

function onClickCloseOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  savedFiles: Accessor<BasicFile[]>,
  setOpenFiles: Setter<ReactiveFile[]>,
  confirmAction: Accessor<string>,
  setConfirmAction: Setter<string>,
) {
  let currentOpenFiles = openFiles();
  let openFile = currentOpenFiles[index];

  if (openFile) {
    let savedFile = savedFiles().find((f) => f.name === openFile.name());
    if (savedFile && savedFile.content !== openFile.content()) {
      if (confirmAction() === "discardChanges") {
        currentOpenFiles.splice(index, 1);
        setOpenFiles([...currentOpenFiles]);
        setConfirmAction("");
      } else {
        setConfirmAction("discardChanges");
      }
    } else {
      currentOpenFiles.splice(index, 1);
      setOpenFiles([...currentOpenFiles]);
      setConfirmAction("");
    }
  }
}

function onClickSaveOpenFile(
  index: number,
  openFiles: Accessor<ReactiveFile[]>,
  savedFiles: Accessor<BasicFile[]>,
  setSavedFiles: Setter<BasicFile[]>,
) {
  let openFile: ReactiveFile | undefined = openFiles()[index];
  let savedFile: BasicFile | undefined = savedFiles().splice(
    savedFiles().findIndex((sf) => sf.name === openFile.name()),
    1,
  )[0];

  if (openFile) {
    setSavedFiles([
      ...savedFiles(),
      { name: openFile.name(), content: openFile.content() },
    ]);
  }
}

function onInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  inputSetter: Setter<string>,
  openFilesAccessor: Accessor<ReactiveFile[]>,
  filteredOpenFilesAccessor: Accessor<ReactiveFile[]>,
  openFilesSetter: Setter<ReactiveFile[]>,
  filteredSavedFilesAccessor: Accessor<BasicFile[]>,
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
          (filteredSavedFilesAccessor().length =
            1 && (filteredOpenFilesAccessor().length = 0))
        ) {
          const savedFile = filteredSavedFilesAccessor()[0];
          const [name, setName] = createSignal<string>(savedFile.name);
          const [content, setContent] = createSignal<string>(savedFile.content);
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

async function onClickUploadFile() {}

export default App;
