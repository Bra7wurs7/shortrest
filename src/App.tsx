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
import { ClipboardEntry } from "./types/clipboardEntry.interface";
import { ViewedFile } from "./types/viewedFile.interface";
import {
  loadClipboard,
  storeClipboard,
  storeViewedFile,
  loadViewedFile,
} from "./functions/storage.functions";
import {
  getFileContent,
  listAllDirectories,
  listFileNamesInDirectory,
} from "./functions/dbFilesInterface.functions";
import { ConfirmAction } from "./types/confirmAction.enum";
import { parseFileName } from "./functions/parseFileName.function";
import { ParsedFileName } from "./types/parsedFileName.interface";
import { BasicFile } from "./types/basicFile.interface";
import {
  onClickSavedFile,
  onClickClipboardFile,
  onDiscardClipboardFile,
  onSaveClipboardFile,
  onClickTrashSavedFile,
  onInputKeyUp,
  onUpdateDirectory,
  onClickDownloadSavedFile,
  onClickDownloadClipboardFile,
  onClickUploadDirectory,
  onClickDownloadDirectory,
  onInputExistingFileName,
  onRenameClipboardFile,
  onRenameSavedFile,
  getOrCreateEditableFile,
  ensureEmptyClipboardFile,
} from "./app-handlers";
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

  // Clipboard: files with unsaved changes
  const [clipboard, setClipboard] =
    createSignal<ClipboardEntry[]>(loadClipboard());

  // Viewed file: what's currently displayed (from IDB or clipboard)
  const [viewedFile, setViewedFile] = createSignal<ViewedFile | null>(
    loadViewedFile(),
  );

  // IDB file content: populated when viewing an IDB file
  const [idbFileContent, setIdbFileContent] = createSignal<string>("");

  const [inputValue, setInputValue] = createSignal<string>("");
  const [confirmAction, setConfirmAction] = createSignal<ConfirmAction | null>(
    null,
  );
  const [rightClickedClipboardFile, setRightClickedClipboardFile] =
    createSignal<string | null>(null);
  const [
    rightClickedClipboardFileNewName,
    setRightClickedClipboardFileNewName,
  ] = createSignal<string | null>(null);
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
  const filteredParsedClipboardFileNames = createMemo<ParsedFileName[]>(() => {
    return clipboard()
      .filter((entry) =>
        entry.name().toLowerCase().includes(inputValue().toLowerCase()),
      )
      .map((entry) => parseFileName(entry.name()));
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

  // The currently displayed file content
  const displayedFileContent = createMemo<string>(() => {
    const vf = viewedFile();
    if (!vf) return "";

    if (vf.source === "clipboard") {
      const entry = clipboard().find((c) => c.name() === vf.fileName);
      return entry?.content() ?? "";
    }

    // IDB source - return the fetched content
    return idbFileContent();
  });

  // The currently displayed file name
  const displayedFileName = createMemo<string | null>(() => {
    const vf = viewedFile();
    return vf?.fileName ?? null;
  });

  // Check if currently viewing a clipboard file
  const isViewingClipboardFile = createMemo<boolean>(() => {
    return viewedFile()?.source === "clipboard";
  });

  // Get the current clipboard entry if viewing one
  const currentClipboardEntry = createMemo<ClipboardEntry | null>(() => {
    const vf = viewedFile();
    if (vf?.source === "clipboard") {
      return clipboard().find((c) => c.name() === vf.fileName) ?? null;
    }
    return null;
  });

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
  // Effects - IDB file content loading
  // ============================================
  createEffect(() => {
    const vf = viewedFile();
    if (vf?.source === "idb" && vf.directoryName && vf.fileName) {
      getFileContent(vf.directoryName, vf.fileName).then((content) => {
        setIdbFileContent(content ?? "");
      });
    } else if (vf?.source === "clipboard") {
      // Clear IDB content when viewing clipboard
      setIdbFileContent("");
    }
  });

  // ============================================
  // Effects - Ensure clipboard always has an empty file
  // ============================================
  createEffect(() => {
    // Track clipboard changes to ensure there's always an empty file ready
    clipboard();
    ensureEmptyClipboardFile(clipboard, setClipboard, activeDirectoryName);
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
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!ollama || !model) {
      console.warn("Cannot submit prompt: missing ollama or model");
      return;
    }

    // Get or create an editable clipboard entry
    const targetEntry = getOrCreateEditableFile(
      viewedFile,
      setViewedFile,
      clipboard,
      setClipboard,
      idbFileContent,
      activeDirectoryName,
    );

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
      targetEntry,
      clipboard,
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

  /**
   * Handle textarea input - create clipboard entry on first edit if viewing IDB file
   */
  function handleTextareaInput(value: string) {
    const vf = viewedFile();

    if (vf?.source === "clipboard") {
      // Already viewing clipboard file - update directly
      const entry = clipboard().find((c) => c.name() === vf.fileName);
      if (entry) {
        entry.setContent(value);
        storeClipboard(clipboard);
      }
    } else {
      // Viewing IDB file or nothing - need to create clipboard entry
      const entry = getOrCreateEditableFile(
        viewedFile,
        setViewedFile,
        clipboard,
        setClipboard,
        idbFileContent,
        activeDirectoryName,
      );
      entry.setContent(value);
      storeClipboard(clipboard);
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
            clipboard,
            setClipboard,
            filteredParsedClipboardFileNames,
            filteredParsedAllFileNames,
            setViewedFile,
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
              <For each={filteredParsedClipboardFileNames()}>
                {(parsedName: ParsedFileName, index: Accessor<number>) => (
                  <Switch>
                    <Match
                      when={rightClickedClipboardFile() !== parsedName.fullName}
                    >
                      <button
                        class={
                          "button_file " +
                          (viewedFile()?.source === "clipboard" &&
                          viewedFile()?.fileName === parsedName.fullName
                            ? "active "
                            : "") +
                          (rightClickedClipboardFile() === parsedName.fullName
                            ? "context_menu"
                            : "")
                        }
                        onclick={() => {
                          onClickClipboardFile(
                            parsedName.fullName,
                            setViewedFile,
                          );
                        }}
                        oncontextmenu={(e: PointerEvent) => {
                          e.preventDefault();
                          setRightClickedClipboardFile(parsedName.fullName);
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
                      when={rightClickedClipboardFile() === parsedName.fullName}
                    >
                      <div
                        class="button_file_contextmenu"
                        onmouseleave={() => {
                          setRightClickedClipboardFile(null);
                          setRightClickedClipboardFileNewName(null);
                          setConfirmAction(null);
                        }}
                        onClick={() => {
                          setRightClickedClipboardFile(null);
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
                              setRightClickedClipboardFileNewName,
                            );
                          }}
                        >
                          {parsedName.fullName ?? "unnamed file"}
                        </div>
                        <div class="actions">
                          <Switch>
                            <Match
                              when={
                                rightClickedClipboardFileNewName() === null ||
                                rightClickedClipboardFile() ===
                                  rightClickedClipboardFileNewName()
                              }
                            >
                              <button
                                class="button_icon"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  onClickDownloadClipboardFile(
                                    clipboard,
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
                                  onSaveClipboardFile(
                                    index(),
                                    clipboard,
                                    setClipboard,
                                    directoryNames,
                                    setDirectoryNames,
                                    activeDirectoryParsedFileNames,
                                    setActiveDirectoryParsedFileNames,
                                    activeDirectoryName,
                                    viewedFile,
                                    setViewedFile,
                                    setRightClickedClipboardFile,
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
                                  onDiscardClipboardFile(
                                    index(),
                                    clipboard,
                                    setClipboard,
                                    viewedFile,
                                    setViewedFile,
                                    confirmAction,
                                    setConfirmAction,
                                    setRightClickedClipboardFile,
                                  ).then();
                                }}
                              >
                                <i class="bx bx-x-circle"></i>
                              </button>
                            </Match>
                            <Match
                              when={
                                rightClickedClipboardFile() !==
                                rightClickedClipboardFileNewName()
                              }
                            >
                              <button
                                class="button_icon"
                                onclick={(e) => {
                                  e.stopPropagation();
                                  onRenameClipboardFile(
                                    rightClickedClipboardFile(),
                                    rightClickedClipboardFileNewName(),
                                    clipboard,
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
            <Show when={filteredParsedClipboardFileNames().length > 0}>
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
                            (viewedFile()?.source === "idb" &&
                            viewedFile()?.fileName === parsedName.fullName
                              ? "active "
                              : "") +
                            (rightClickedSavedFile() === parsedName.fullName
                              ? "context_menu"
                              : "")
                          }
                          onclick={() => {
                            const activeDirName = activeDirectoryName();
                            if (activeDirName) {
                              onClickSavedFile(
                                parsedName.fullName,
                                activeDirName,
                                setViewedFile,
                              );
                            }
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
              value={displayedFileContent()}
              oninput={(e) => {
                handleTextareaInput(e.currentTarget.value);
              }}
            />
          </Match>
          <Match when={appMode() === AppMode.MdReader}>
            {MdReader(displayedFileContent)}
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
              displayedFileContent={displayedFileContent}
              displayedFileName={displayedFileName}
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

export default App;
