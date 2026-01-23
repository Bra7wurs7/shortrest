import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Setter,
  Show,
  Switch,
  untrack,
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
import { BasicFile } from "./types/basicFile.interface";
import { storeActiveFileName } from "./functions/storeActiveFileName.function";
import { SettingsComponent } from "./components/settings.component";
import { AiWriter } from "./components/aiWriter.component";
import {
  AbortableAsyncIterator,
  ChatResponse,
  ModelResponse,
  Ollama,
} from "ollama";
import { MdReader } from "./components/mdReader.component";
import { buildMessages } from "./functions/llm/buildMessages.function";
import { streamToFile } from "./functions/llm/streamToFile.function";
import { streamToSignal } from "./functions/llm/streamToSignal.function";
import { TextUnits } from "./types/textUnits.enum";
import { PromptState } from "./types/promptState.interface";
import {
  localStorageChatUserPrompt,
  localStorageChatSystemPrompt,
  localStorageChatAssistentPromptLength,
  localStorageChatAssistentPromptUnit,
  localStorageChatModelThoughts,
  sessionStorageDisabledTags,
  sessionStorageDisabledFiles,
  sessionStorageDisabledSysPrompt,
  sessionStorageDisabledAllTags,
  sessionStorageDisabledFileContext,
  sessionStorageDisabledAllFiles,
  sessionStorageDisabledThoughts,
  sessionStorageDisabledUserPrompt,
  localStorageActiveDirectoryName,
  localStorageActiveFileNameKey,
  localStorageAppMode,
  localStorageOllamaModel,
  localStorageOllamaUrl,
} from "./constants/storageKeys";
import { appModes } from "./constants/appModes";

function App(): JSXElement {
  // ============================================
  // App-level signals
  // ============================================
  const [appMode, setAppMode] = createSignal<AppMode>(
    localStorage.getItem(localStorageAppMode) as AppMode,
  );
  const [directoryNames, setDirectoryNames] = createSignal<string[]>([]);
  const [activeDirectoryName, setActiveDirectoryName] = createSignal<
    string | null
  >(localStorage.getItem(localStorageActiveDirectoryName));
  const [openFiles, setOpenFiles] =
    createSignal<ReactiveFile[]>(loadOpenFiles());
  const [activeFileName, setActiveFileName] = createSignal<string | null>(
    localStorage.getItem(localStorageActiveFileNameKey),
  );
  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(
    null,
  );
  const [rightClickedOpenFile, setRightClickedOpenFile] = createSignal<
    string | null
  >(null);
  const [rightClickedOpenFileNewName, setRightClickedOpenFileNewName] =
    createSignal<string | null>(null);
  const [rightClickedSavedFile, setRightClickedSavedFile] = createSignal<
    string | null
  >(null);
  const [rightClickedSavedFileNewName, setRightClickedSavedFileNewName] =
    createSignal<string | null>(null);
  const [rightClickedDirectory, setRightClickedDirectory] = createSignal<
    string | null
  >(null);
  const [hoveredDirectoryName, setHoveredDirectoryName] = createSignal<
    string | null
  >(null);

  // ============================================
  // Ollama connection signals
  // ============================================
  const [ollamaConnection, setOllamaConnection] = createSignal<Ollama | null>(
    new Ollama(),
  );
  const [ollamaUrl, setOllamaUrl] = createSignal<string>(
    localStorage.getItem(localStorageOllamaUrl) || "127.0.0.1:11434",
  );
  const [ollamaModels, setOllamaModels] = createSignal<ModelResponse[] | null>(
    null,
  );
  const [ollamaModel, setOllamaModel] = createSignal<ModelResponse | null>(
    null,
  );

  // ============================================
  // Prompt state signals (explicit, no context)
  // ============================================
  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
  );
  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatSystemPrompt) ?? "",
  );
  const [modelThoughts, setModelThoughts] = createSignal<string>(
    localStorage.getItem(localStorageChatModelThoughts) ?? "",
  );
  const [disabledTags, setDisabledTags] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledTags) ?? "[]"),
  );
  const [disabledFiles, setDisabledFiles] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledFiles) ?? "[]"),
  );
  const [disabledSystemPrompt, setDisabledSystemPrompt] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledSysPrompt) ?? "false",
    ),
  );
  const [disabledAllTags, setDisabledAllTags] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledAllTags) ?? "false",
    ),
  );
  const [disabledFileContext, setDisabledFileContext] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledFileContext) ?? "false",
    ),
  );
  const [disabledAllFiles, setDisabledAllFiles] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledAllFiles) ?? "false",
    ),
  );
  const [disabledThoughts, setDisabledThoughts] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledThoughts) ?? "false",
    ),
  );
  const [disabledUserPrompt, setDisabledUserPrompt] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledUserPrompt) ?? "false",
    ),
  );
  const [reducedFileContentLength, setReducedFileContentLength] =
    createSignal<number>(
      Number(localStorage.getItem(localStorageChatAssistentPromptLength)) || 0,
    );
  const [reducedFileContentUnit, setReducedFileContentUnit] =
    createSignal<TextUnits>(
      (localStorage.getItem(localStorageChatAssistentPromptUnit) ??
        TextUnits.Sentences) as TextUnits,
    );
  const [runningPrompt, setRunningPrompt] =
    createSignal<AbortableAsyncIterator<ChatResponse> | null>(null);

  // Bundle prompt state for passing to components
  const promptState: PromptState = {
    userPrompt,
    setUserPrompt,
    systemPrompt,
    setSystemPrompt,
    modelThoughts,
    setModelThoughts,
    disabledTags,
    setDisabledTags,
    disabledFiles,
    setDisabledFiles,
    disabledSystemPrompt,
    setDisabledSystemPrompt,
    disabledAllTags,
    setDisabledAllTags,
    disabledFileContext,
    setDisabledFileContext,
    disabledAllFiles,
    setDisabledAllFiles,
    disabledThoughts,
    setDisabledThoughts,
    disabledUserPrompt,
    setDisabledUserPrompt,
    reducedFileContentLength,
    setReducedFileContentLength,
    reducedFileContentUnit,
    setReducedFileContentUnit,
    runningPrompt,
    setRunningPrompt,
  };

  // ============================================
  // Derived data from AiWriter (set via callbacks)
  // ============================================
  const [reducedFileContent, setReducedFileContent] = createSignal<string>("");
  const [referencedFilesContents, setReferencedFilesContents] = createSignal<
    BasicFile[]
  >([]);
  const [referencedTagFileContents, setReferencedTagFileContents] =
    createSignal<BasicFile[]>([]);

  // ============================================
  // Directory file name signals
  // ============================================
  const [activeDirectoryParsedFileNames, setActiveDirectoryParsedFileNames] =
    createSignal<ParsedFileName[] | null>(null);

  const [hoveredDirectoryFileNames, setHoveredDirectoryFileNames] =
    createSignal<ParsedFileName[] | null>(null);

  // ============================================
  // Memos
  // ============================================
  const filteredParsedOpenFileNames = createMemo<ParsedFileName[]>(() => {
    return openFiles()
      .filter((of) =>
        of.name().toLowerCase().includes(inputValue().toLowerCase()),
      )
      .map((of) => parseFileName(of.name()));
  });

  const filteredParsedAllFileNames = createMemo<ParsedFileName[] | null>(() => {
    const activeDirFileNames = activeDirectoryParsedFileNames();
    if (activeDirFileNames) {
      return activeDirFileNames.filter((name: ParsedFileName) =>
        name.baseName.includes(inputValue().toLowerCase()),
      );
    }
    return null;
  });

  const activeFile = createMemo<ReactiveFile | null>(
    () => openFiles().find((of) => of.name() === activeFileName()) ?? null,
  );

  // ============================================
  // Effects - Persistence
  // ============================================

  // Prompt persistence to localStorage
  createEffect(() => {
    localStorage.setItem(localStorageChatUserPrompt, userPrompt());
  });
  createEffect(() => {
    localStorage.setItem(localStorageChatSystemPrompt, systemPrompt());
  });
  createEffect(() => {
    localStorage.setItem(localStorageChatModelThoughts, modelThoughts());
  });
  createEffect(() => {
    localStorage.setItem(
      localStorageChatAssistentPromptLength,
      String(reducedFileContentLength()),
    );
  });
  createEffect(() => {
    localStorage.setItem(
      localStorageChatAssistentPromptUnit,
      reducedFileContentUnit(),
    );
  });

  // Toggle persistence to sessionStorage
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledTags,
      JSON.stringify(disabledTags()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledFiles,
      JSON.stringify(disabledFiles()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledSysPrompt,
      JSON.stringify(disabledSystemPrompt()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledAllTags,
      JSON.stringify(disabledAllTags()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledFileContext,
      JSON.stringify(disabledFileContext()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledAllFiles,
      JSON.stringify(disabledAllFiles()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledThoughts,
      JSON.stringify(disabledThoughts()),
    );
  });
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledUserPrompt,
      JSON.stringify(disabledUserPrompt()),
    );
  });

  // ============================================
  // Effects - Ollama
  // ============================================
  createEffect(() => {
    setOllamaConnection(new Ollama({ host: ollamaUrl() }));
  });
  createEffect(() => {
    ollamaConnection()
      ?.list()
      .then((m) => {
        setOllamaModels(m.models);
      })
      .catch((e) => {
        setOllamaModels(null);
      });
  });
  createEffect(() => {
    const llmModel = ollamaModel();
    if (llmModel !== null) {
      localStorage.setItem(localStorageOllamaModel, llmModel.model);
    }
  });
  createEffect(() => {
    localStorage.setItem(localStorageOllamaUrl, ollamaUrl());
  });
  createEffect(() => {
    const llmModel = untrack(ollamaModel);
    const allLlmModels = ollamaModels();
    if (allLlmModels && allLlmModels.length > 0 && llmModel === null) {
      const localStorageModelName = localStorage.getItem(
        localStorageOllamaModel,
      );
      const model = allLlmModels.find((m) => m.model === localStorageModelName);
      if (model !== undefined) {
        setOllamaModel(model);
      } else {
        setOllamaModel(allLlmModels[0] ?? null);
      }
    }
  });

  // ============================================
  // Effects - Directory loading
  // ============================================
  createEffect(() => {
    const activeDirName = activeDirectoryName();
    if (activeDirName) {
      listFileNamesInDirectory(activeDirName).then((names) => {
        setActiveDirectoryParsedFileNames(names.map((fn) => parseFileName(fn)));
      });
    }
  });

  createEffect(() => {
    const hoveredDirName = hoveredDirectoryName();
    if (hoveredDirName) {
      listFileNamesInDirectory(hoveredDirName).then((names) => {
        setHoveredDirectoryFileNames(names.map((name) => parseFileName(name)));
      });
    } else {
      setHoveredDirectoryFileNames(null);
    }
  });

  // ============================================
  // Initialization
  // ============================================
  listAllDirectories().then((names) => {
    setDirectoryNames(names);
    onUpdateDirectory(directoryNames, setDirectoryNames).then(() => {
      const storedDirName = activeDirectoryName();
      const currentDirNames = directoryNames();

      if (!storedDirName || !currentDirNames.includes(storedDirName)) {
        const emptyDirectory = currentDirNames[0];
        if (emptyDirectory) {
          setActiveDirectoryName(emptyDirectory);
          localStorage.setItem(localStorageActiveDirectoryName, emptyDirectory);
        }
      }
    });
  });

  // ============================================
  // LLM prompt handlers
  // ============================================
  async function handlePromptSubmit() {
    const file = activeFile();
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!file || !ollama || !model) {
      console.warn("Cannot submit prompt: missing file, ollama, or model");
      return;
    }

    const messages = buildMessages({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(),
      fileContent: reducedFileContent(),
      modelThoughts: modelThoughts(),
      tagFileContents: referencedTagFileContents(),
      referencedFileContents: referencedFilesContents(),
      disabledTags: disabledTags(),
      disabledFiles: disabledFiles(),
      disabledAllTags: disabledAllTags(),
      disabledAllFiles: disabledAllFiles(),
      disabledSystemPrompt: disabledSystemPrompt(),
      disabledFileContext: disabledFileContext(),
      disabledThoughts: disabledThoughts(),
    });

    await streamToFile({
      ollama,
      model: model.model,
      messages,
      targetFile: file,
      openFiles,
      setRunningPrompt,
    });
  }

  async function handleThinkSubmit() {
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!ollama || !model) {
      console.warn("Cannot submit think: missing ollama or model");
      return;
    }

    const messages = buildMessages({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(),
      fileContent: reducedFileContent(),
      modelThoughts: modelThoughts(),
      tagFileContents: referencedTagFileContents(),
      referencedFileContents: referencedFilesContents(),
      disabledTags: disabledTags(),
      disabledFiles: disabledFiles(),
      disabledAllTags: disabledAllTags(),
      disabledAllFiles: disabledAllFiles(),
      disabledSystemPrompt: disabledSystemPrompt(),
      disabledFileContext: disabledFileContext(),
      disabledThoughts: disabledThoughts(),
    });

    await streamToSignal({
      ollama,
      model: model.model,
      messages,
      setTargetSignal: setModelThoughts,
      setRunningPrompt,
      stopSequence: "</think>",
    });
  }

  function handleCentralInputKeyUp(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    if (e.key === "Enter") {
      handlePromptSubmit();
    }
  }

  // ============================================
  // Render
  // ============================================
  return (
    <div id="APP_CONTAINER" class="dark_theme">
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
      <div id="LEFT_SIDE">
        <div id="LEFT_TOOLBAR">
          <div id="LM_S_ACTIONS"></div>
          <div id="LM_S_BOTTOM">
            <button
              class="button_icon"
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
                          localStorage.setItem(
                            localStorageActiveDirectoryName,
                            name,
                          );
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
                          when={
                            !(name === activeDirectoryName()) && index() > 0
                          }
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
        <div
          id="LEFT_SIDEBAR"
          class={
            hoveredDirectoryFileNames() !== null &&
            hoveredDirectoryName() !== activeDirectoryName()
              ? "showing_hovered_directory"
              : ""
          }
        >
          <div id="L_S_TOP">
            <div id="L_S_OPENFILES">
              <For each={filteredParsedOpenFileNames()}>
                {(parsedName: ParsedFileName, index: Accessor<number>) => (
                  <Switch>
                    <Match
                      when={rightClickedOpenFile() !== parsedName.fullName}
                    >
                      <button
                        class={
                          "button_file " +
                          (activeFileName() === parsedName.fullName
                            ? "active "
                            : "") +
                          (rightClickedOpenFile() === parsedName.fullName
                            ? "context_menu"
                            : "")
                        }
                        onclick={() => {
                          setActiveFileName(parsedName.fullName);
                          storeActiveFileName(parsedName.fullName);
                        }}
                        oncontextmenu={(e: PointerEvent) => {
                          e.preventDefault();
                          setRightClickedOpenFile(parsedName.fullName);
                        }}
                      >
                        <div class="filename bg">
                          <Switch>
                            <Match when={parsedName.baseName}>
                              <i class="bx bxs-file"></i>
                            </Match>
                            <Match when={parsedName.baseName === ""}>
                              <i class="bx bxs-tag-alt"></i>
                            </Match>
                          </Switch>
                          {parsedName.baseName}
                        </div>
                        <div class="tags">
                          <For each={parsedName.tags}>
                            {(tag: string) => <span>&nbsp;{tag}</span>}
                          </For>
                        </div>
                      </button>
                    </Match>
                    <Match
                      when={rightClickedOpenFile() === parsedName.fullName}
                    >
                      <div
                        class="button_file_contextmenu"
                        onmouseleave={() => {
                          setRightClickedOpenFile(null);
                          setRightClickedOpenFileNewName(null);
                          setConfirmAction(null);
                        }}
                        onClick={() => {
                          setRightClickedOpenFile(null);
                        }}
                      >
                        <div
                          class="filename text_overflow_fade bg"
                          contenteditable
                          onclick={(e) => {
                            e.stopPropagation();
                          }}
                          oninput={(e) => {
                            onInputExistingFileName(
                              e,
                              setRightClickedOpenFileNewName,
                            );
                          }}
                        >
                          {parsedName.fullName ?? "unnamed file"}
                        </div>
                        <div class="actions">
                          <Switch>
                            <Match
                              when={
                                rightClickedOpenFileNewName() === null ||
                                rightClickedOpenFile() ===
                                  rightClickedOpenFileNewName()
                              }
                            >
                              <button
                                class="button_icon"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  onClickDownloadOpenFile(
                                    openFiles,
                                    parsedName.fullName,
                                  );
                                }}
                              >
                                <i class="bx bxs-download"></i>
                              </button>
                              <button
                                class="button_icon"
                                onclick={(e) => {
                                  e.stopImmediatePropagation();
                                  onClickSaveOpenFile(
                                    index(),
                                    openFiles,
                                    directoryNames,
                                    setDirectoryNames,
                                    activeDirectoryParsedFileNames,
                                    setActiveDirectoryParsedFileNames,
                                    activeDirectoryName,
                                  );
                                }}
                              >
                                <i class="bx bx-save"></i>
                              </button>
                              <button
                                class={
                                  "button_icon " +
                                  (confirmAction() ===
                                  ConfirmAction.DiscardChanges
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
                                    setRightClickedOpenFile,
                                  ).then();
                                }}
                              >
                                <i class="bx bx-x-circle"></i>
                              </button>
                            </Match>
                            <Match
                              when={
                                rightClickedOpenFile() !==
                                rightClickedOpenFileNewName()
                              }
                            >
                              <button
                                class="button_icon"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  onRenameOpenFile(
                                    rightClickedOpenFile(),
                                    rightClickedOpenFileNewName(),
                                    openFiles,
                                  );
                                }}
                              >
                                <i class="bx bx-check"></i>
                              </button>
                            </Match>
                          </Switch>
                        </div>
                      </div>
                    </Match>
                  </Switch>
                )}
              </For>
            </div>
            <Show when={filteredParsedOpenFileNames().length > 0}>
              <div class="filelist_footer">
                <i class="bx bx-clipboard"></i>
                <span>Clipboard</span>
              </div>
            </Show>
          </div>
          <div id="L_S_BOTTOM">
            <Show
              when={
                hoveredDirectoryFileNames()
                  ? hoveredDirectoryFileNames()!.length > 0
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
                      ? hoveredDirectoryFileNames()
                      : filteredParsedAllFileNames()
                  }
                >
                  {(parsedName: ParsedFileName, index: Accessor<number>) => (
                    <Switch>
                      <Match
                        when={rightClickedSavedFile() !== parsedName.fullName}
                      >
                        <button
                          class={
                            "button_file " +
                            (rightClickedSavedFile() === parsedName.fullName
                              ? "context_menu"
                              : "")
                          }
                          onclick={() => {
                            onClickSavedFile(
                              parsedName.fullName,
                              activeDirectoryName,
                              openFiles,
                              setOpenFiles,
                              setActiveFileName,
                            );
                          }}
                          oncontextmenu={(e: PointerEvent) => {
                            e.preventDefault();
                            setRightClickedSavedFile(parsedName.fullName);
                          }}
                        >
                          <div class="filename text_overflow_fade bg">
                            <Switch>
                              <Match when={parsedName.baseName}>
                                <i class="bx bxs-file"></i>
                              </Match>
                              <Match when={parsedName.baseName === ""}>
                                <i class="bx bxs-tag-alt"></i>
                              </Match>
                            </Switch>
                            {parsedName.baseName}
                          </div>
                          <div class="tags">
                            <For each={parsedName.tags}>
                              {(tag: string) => <span>&nbsp;{tag}</span>}
                            </For>
                          </div>
                        </button>
                      </Match>
                      <Match
                        when={rightClickedSavedFile() === parsedName.fullName}
                      >
                        <div
                          class="button_file_contextmenu"
                          onmouseleave={() => {
                            setRightClickedSavedFile(null);
                            setRightClickedSavedFileNewName(null);
                            setConfirmAction(null);
                          }}
                          onClick={() => {
                            setRightClickedSavedFile(null);
                          }}
                        >
                          <div
                            class="filename"
                            contenteditable
                            onclick={(e) => {
                              e.stopPropagation();
                            }}
                            oninput={(e) => {
                              onInputExistingFileName(
                                e,
                                setRightClickedSavedFileNewName,
                              );
                            }}
                          >
                            {parsedName.fullName ?? "unnamed file"}
                          </div>
                          <div class="actions">
                            <Switch>
                              <Match
                                when={
                                  rightClickedSavedFileNewName() === null ||
                                  rightClickedSavedFileNewName() ===
                                    rightClickedSavedFile()
                                }
                              >
                                <button
                                  class="button_icon"
                                  onclick={(e) => {
                                    onClickDownloadSavedFile(
                                      activeDirectoryName,
                                      parsedName.fullName,
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
                                      parsedName.fullName,
                                      activeDirectoryName,
                                      activeDirectoryParsedFileNames,
                                      setActiveDirectoryParsedFileNames,
                                      directoryNames,
                                      setDirectoryNames,
                                      confirmAction,
                                      setConfirmAction,
                                      setRightClickedSavedFile,
                                    ).then();
                                  }}
                                >
                                  <i class="bx bxs-trash-alt"></i>
                                </button>
                              </Match>
                              <Match
                                when={
                                  rightClickedSavedFileNewName() !== null &&
                                  rightClickedSavedFileNewName() !==
                                    rightClickedSavedFile()
                                }
                              >
                                <button
                                  class="button_icon"
                                  onclick={(e) => {
                                    e.stopPropagation();
                                    onRenameSavedFile(
                                      parsedName.fullName,
                                      rightClickedSavedFileNewName(),
                                      activeDirectoryParsedFileNames,
                                      setActiveDirectoryParsedFileNames,
                                      activeDirectoryName,
                                      directoryNames,
                                      setDirectoryNames,
                                    );
                                  }}
                                >
                                  <i class="bx bx-check"></i>
                                </button>
                              </Match>
                            </Switch>
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
      </div>
      <div id="CENTER">
        <Switch>
          <Match when={appMode() === AppMode.AiWriter}>
            <textarea
              id="BASIC_TEXT_EDITOR"
              value={activeFile()?.content() ?? ""}
              onkeyup={(e) => {
                activeFile()?.setContent(e.currentTarget.value);
              }}
              onchange={(e) => {
                storeOpenFiles(openFiles);
              }}
            />
          </Match>
          <Match when={appMode() === AppMode.MdReader}>
            {MdReader(activeFile)}
          </Match>
          <Match when={appMode() === AppMode.Settings}>
            {SettingsComponent(
              ollamaConnection,
              setOllamaConnection,
              ollamaModel,
              setOllamaModel,
              ollamaModels,
              setOllamaModels,
              ollamaUrl,
              setOllamaUrl,
            )}
          </Match>
        </Switch>
        <Switch>
          <Match
            when={
              appMode() === AppMode.AiWriter || appMode() === AppMode.MdReader
            }
          >
            <input
              id="CENTRAL_PROMPT_INPUT"
              value={userPrompt()}
              onInput={(e) => setUserPrompt(e.currentTarget.value)}
              onKeyUp={handleCentralInputKeyUp}
              placeholder="Enter prompt..."
            />
          </Match>
        </Switch>
      </div>
      <div id="RIGHT_SIDE">
        <Switch>
          <Match
            when={
              appMode() === AppMode.AiWriter || appMode() === AppMode.MdReader
            }
          >
            <AiWriter
              displayedReactiveFile={activeFile}
              activeDirectoryParsedFileNames={activeDirectoryParsedFileNames}
              activeDirectoryName={activeDirectoryName}
              promptState={promptState}
              setReducedFileContent={setReducedFileContent}
              setReferencedFilesContents={setReferencedFilesContents}
              setReferencedTagFileContents={setReferencedTagFileContents}
            />
          </Match>
        </Switch>
        <div id="RIGHT_TOOLBAR">
          <For each={appModes}>
            {(am) => {
              return (
                <button
                  onclick={() => {
                    setAppMode(am.mode);
                    localStorage.setItem(localStorageAppMode, am.mode);
                  }}
                  class={
                    "button_icon " + (appMode() === am.mode ? "active" : "")
                  }
                >
                  <i class={"bx " + am.icon}></i>
                </button>
              );
            }}
          </For>
          <button class="button_icon">
            <i class="bx bx-network-chart" />
          </button>
        </div>
      </div>
      <div id="RIGHT_SIDE_BUTTONS">
        <button
          class="user_action"
          title="Read from and write to the active file"
          onClick={handlePromptSubmit}
        >
          Continue Text
          <i class="bx bx-play-circle" />
        </button>
        <button
          class="user_action fixed_width_icon"
          title="Have the LLM think about the active file"
          onClick={handleThinkSubmit}
        >
          <i class="bx bx-network-chart" />
        </button>
      </div>
    </div>
  );
}

function onClickSavedFile(
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

async function onClickCloseOpenFile(
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

function onClickSaveOpenFile(
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

async function onClickTrashSavedFile(
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

function onClickDownloadDirectory(name: string) {
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

function onInputExistingFileName(
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

function onRenameOpenFile(
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

async function onRenameSavedFile(
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

export default App;
