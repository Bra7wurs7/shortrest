import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  untrack,
  type JSXElement,
} from "solid-js";
import { FileViewerMode } from "./types/fileViewerMode.enum";
import { ClipboardEntry } from "./types/clipboardEntry.interface";
import { ViewedFile } from "./types/viewedFile.interface";
import {
  loadClipboard,
  storeClipboard,
  loadViewedFile,
  storeViewedFile,
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
import { streamContentToSignal } from "./functions/llm/streamContentToSignal.function";
import { buildSummaryPrompt } from "./functions/llm/buildSummaryPrompt.function";
import { TextUnits } from "./types/textUnits.enum";
import { SummaryStyle } from "./types/summaryStyle.enum";
import { PromptState } from "./types/promptState.interface";
import {
  localStorageChatUserPrompt,
  localStorageChatSystemPrompt,
  localStorageChatAssistentPromptLength,
  localStorageChatAssistentPromptUnit,
  localStorageChatModelThoughts,
  localStorageRollingSummary,
  localStorageSummaryStyle,
  localStorageAutoSummarize,
  sessionStorageDisabledTags,
  sessionStorageDisabledFiles,
  sessionStorageDisabledSysPrompt,
  sessionStorageDisabledAllTags,
  sessionStorageDisabledFileContext,
  sessionStorageDisabledAllFiles,
  sessionStorageDisabledThoughts,
  sessionStorageDisabledUserPrompt,
  localStorageActiveDirectoryName,
  localStorageFileViewerMode,
  localStorageOllamaModel,
  localStorageOllamaSummaryModel,
  localStorageOllamaUrl,
  localStorageRightSidebarMode,
} from "./constants/storageKeys";
import { appModes } from "./constants/appModes";
import { RightSidebarMode } from "./types/rightSidebarMode.enum";
import { TestBench } from "./components/testBench.component";
import { CodeMirrorEditor } from "./components/codeMirrorEditor.component";
import { extractBracketQuery } from "./functions/extractBracketQuery.function";
import { longestCommonPrefix } from "./functions/longestCommonPrefix.function";

function App(): JSXElement {
  // ============================================
  // App-level signals
  // ============================================
  const [fileViewerMode, setFileViewerMode] = createSignal<FileViewerMode>(
    localStorage.getItem(localStorageFileViewerMode) as FileViewerMode,
  );
  const [rightSidebarMode, setRightSidebarMode] =
    createSignal<RightSidebarMode>(
      localStorage.getItem(localStorageRightSidebarMode) as RightSidebarMode,
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
  const [bracketMode, setBracketMode] = createSignal(false);
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
  const [clipboardCollapsed, setClipboardCollapsed] = createSignal(false);
  const [directoryCollapsed, setDirectoryCollapsed] = createSignal(false);

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
  const [ollamaSummaryModel, setOllamaSummaryModel] =
    createSignal<ModelResponse | null>(null);

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

  // Rolling summary signals
  const [rollingSummary, setRollingSummary] = createSignal<string>(
    localStorage.getItem(localStorageRollingSummary) ?? "",
  );
  const [disabledRollingSummary, setDisabledRollingSummary] =
    createSignal<boolean>(false);

  const [summaryStyle, setSummaryStyle] = createSignal<SummaryStyle>(
    (localStorage.getItem(localStorageSummaryStyle) ??
      SummaryStyle.Narrative) as SummaryStyle,
  );
  const [autoSummarize, setAutoSummarize] = createSignal<boolean>(
    JSON.parse(localStorage.getItem(localStorageAutoSummarize) ?? "false"),
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
  const [promptLoading, setPromptLoading] = createSignal(false);

  // Bundle prompt state for passing to components
  const promptState: PromptState = {
    userPrompt,
    setUserPrompt,
    systemPrompt,
    setSystemPrompt,
    modelThoughts,
    setModelThoughts,
    rollingSummary,
    setRollingSummary,
    disabledRollingSummary,
    setDisabledRollingSummary,

    summaryStyle,
    setSummaryStyle,
    autoSummarize,
    setAutoSummarize,
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
    promptLoading,
    setPromptLoading,
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

  const filteredParsedDirectoryFileNames = createMemo<ParsedFileName[] | null>(
    () => {
      const activeDirFileNames = activeDirectoryParsedFileNames();
      if (activeDirFileNames) {
        return activeDirFileNames.filter((name: ParsedFileName) =>
          name.fullName.toLowerCase().includes(inputValue().toLowerCase()),
        );
      }
      return null;
    },
  );

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

  // Rolling summary persistence to localStorage
  createEffect(() => {
    localStorage.setItem(localStorageRollingSummary, rollingSummary());
  });

  createEffect(() => {
    localStorage.setItem(localStorageSummaryStyle, summaryStyle());
  });
  createEffect(() => {
    localStorage.setItem(
      localStorageAutoSummarize,
      JSON.stringify(autoSummarize()),
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
  createEffect(() => {
    const llmModel = ollamaSummaryModel();
    if (llmModel !== null) {
      localStorage.setItem(localStorageOllamaSummaryModel, llmModel.model);
    }
  });
  createEffect(() => {
    const llmModel = untrack(ollamaSummaryModel);
    const allLlmModels = ollamaModels();
    if (allLlmModels && allLlmModels.length > 0 && llmModel === null) {
      const localStorageModelName = localStorage.getItem(
        localStorageOllamaSummaryModel,
      );
      const model = allLlmModels.find((m) => m.model === localStorageModelName);
      if (model !== undefined) {
        setOllamaSummaryModel(model);
      } else {
        setOllamaSummaryModel(allLlmModels[0] ?? null);
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
    onUpdateDirectory(
      directoryNames,
      setDirectoryNames,
      activeDirectoryName,
    ).then(() => {
      const storedDirName = activeDirectoryName();
      const currentDirNames = directoryNames();

      if (!storedDirName || !currentDirNames.includes(storedDirName)) {
        const emptyDirectory = currentDirNames[0];
        if (emptyDirectory) {
          setActiveDirectoryName(emptyDirectory);
          localStorage.setItem(localStorageActiveDirectoryName, emptyDirectory);
        }
      }

      // Validate viewed file: if it points to a directory that no longer exists, clear it
      const vf = viewedFile();
      if (
        vf?.source === "idb" &&
        vf.directoryName &&
        !currentDirNames.includes(vf.directoryName)
      ) {
        setViewedFile(null);
        storeViewedFile(null);
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

    // Determine existing thoughts (only if not disabled)
    const existingThoughts = disabledThoughts() ? "" : modelThoughts();

    const messages = buildMessages({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(),
      fileContent: reducedFileContent(),
      modelThoughts: existingThoughts,
      rollingSummary: rollingSummary(),
      tagFileContents: referencedTagFileContents(),
      referencedFileContents: referencedFilesContents(),
      disabledTags: disabledTags(),
      disabledFiles: disabledFiles(),
      disabledAllTags: disabledAllTags(),
      disabledAllFiles: disabledAllFiles(),
      disabledSystemPrompt: disabledSystemPrompt(),
      disabledRollingSummary: disabledRollingSummary(),
      disabledFileContext: disabledFileContext(),
      disabledThoughts: disabledThoughts(),
    });

    await streamToFile({
      ollama,
      model: model.model,
      messages,
      targetEntry,
      clipboard,
      setClipboard,
      setRunningPrompt,
      setPromptLoading,
      setModelThoughts,
      existingThoughts,
      onStreamComplete: autoSummarize()
        ? () => {
            // Trigger auto-summarize when generation completes
            const hasSummary = rollingSummary().trim().length > 0;
            handleSummaryGenerate(hasSummary ? "extend" : "generate");
          }
        : undefined,
    });
  }

  async function handleThinkSubmit() {
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!ollama || !model) {
      console.warn("Cannot submit think: missing ollama or model");
      return;
    }

    // For think-only, we don't include existing thoughts in the messages
    // because we want the model to generate fresh thinking
    const messages = buildMessages({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(),
      fileContent: reducedFileContent(),
      modelThoughts: "", // Don't include existing thoughts for think-only
      rollingSummary: rollingSummary(),
      tagFileContents: referencedTagFileContents(),
      referencedFileContents: referencedFilesContents(),
      disabledTags: disabledTags(),
      disabledFiles: disabledFiles(),
      disabledAllTags: disabledAllTags(),
      disabledAllFiles: disabledAllFiles(),
      disabledSystemPrompt: disabledSystemPrompt(),
      disabledRollingSummary: disabledRollingSummary(),
      disabledFileContext: disabledFileContext(),
      disabledThoughts: true, // Always disable thoughts in the prompt for think-only
    });

    await streamToSignal({
      ollama,
      model: model.model,
      messages,
      setTargetSignal: setModelThoughts,
      setRunningPrompt,
      setPromptLoading,
    });
  }

  /**
   * Generate or extend the rolling summary based on current file content.
   */
  async function handleSummaryGenerate(mode: "generate" | "extend") {
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!ollama || !model) {
      console.warn("Cannot generate summary: missing ollama or model");
      return;
    }

    const content = reducedFileContent();
    if (!content) {
      console.warn("Cannot generate summary: no file content");
      return;
    }

    const prompt = buildSummaryPrompt({
      fileContent: content,
      existingSummary: rollingSummary(),
      summaryStyle: summaryStyle(),
      mode,
    });

    await streamContentToSignal({
      ollama,
      model: model.model,
      messages: [{ role: "user", content: prompt }],
      setTargetSignal: setRollingSummary,
      setRunningPrompt,
      setPromptLoading,
    });
  }

  function handleCentralInputKeyDown(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    if (e.key === "Tab" && bracketMode()) {
      e.preventDefault();

      const input = e.currentTarget;
      const value = input.value;
      const cursorPos = input.selectionStart ?? value.length;
      const query = extractBracketQuery(value, cursorPos);
      if (query === null) return;

      const clipboardMatches = filteredParsedClipboardFileNames().map(
        (f) => f.fullName,
      );
      const dirMatches = (filteredParsedDirectoryFileNames() ?? []).map(
        (f) => f.fullName,
      );
      const allMatches = [...clipboardMatches, ...dirMatches];
      if (allMatches.length === 0) return;

      const completion = longestCommonPrefix(allMatches);
      if (completion.length <= query.length) return;

      const bracketStart = cursorPos - query.length;

      if (allMatches.length === 1) {
        const newValue =
          value.substring(0, bracketStart) +
          completion +
          "]" +
          value.substring(cursorPos);
        setUserPrompt(newValue);
        setBracketMode(false);
        setInputValue("");
        requestAnimationFrame(() => {
          input.setSelectionRange(
            bracketStart + completion.length + 1,
            bracketStart + completion.length + 1,
          );
        });
      } else {
        const newValue =
          value.substring(0, bracketStart) +
          completion +
          value.substring(cursorPos);
        setUserPrompt(newValue);
        setInputValue(completion);
        requestAnimationFrame(() => {
          input.setSelectionRange(
            bracketStart + completion.length,
            bracketStart + completion.length,
          );
        });
      }
    }
  }

  function handleCentralInputKeyUp(
    e: KeyboardEvent & { currentTarget: HTMLInputElement },
  ) {
    if (e.key === "Enter") {
      handlePromptSubmit();
    }
    if (e.key === "]" && bracketMode()) {
      setBracketMode(false);
      setInputValue("");
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
      <div id="LEFT_INPUT_WRAPPER">
        <i class="bx bx-search"></i>
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
              filteredParsedDirectoryFileNames,
              setViewedFile,
            );
          }}
        ></input>
      </div>
      <div id="LEFT_SIDE">
        <div id="LEFT_TOOLBAR">
          <div id="LM_S_ACTIONS"></div>
          <div id="LM_S_BOTTOM">
            <button
              class="button_icon"
              onclick={(e) => {
                e.stopPropagation();
                onClickUploadDirectory(
                  directoryNames,
                  setDirectoryNames,
                  activeDirectoryName,
                );
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
          <div id="L_S_TOP" class={clipboardCollapsed() ? "collapsed" : ""}>
            <div
              class="filelist_header"
              onclick={() => setClipboardCollapsed(!clipboardCollapsed())}
            >
              <div class="left">
                <i
                  class={
                    "bx " +
                    (clipboardCollapsed()
                      ? "bx-chevron-right"
                      : "bx-chevron-down")
                  }
                ></i>
                <i class="bx bx-clipboard"></i>
                <span>Clipboard</span>
              </div>
              <div class="right"></div>
            </div>
            <Show when={!clipboardCollapsed()}>
              <div id="L_S_CLIPBOARD">
                <For each={filteredParsedClipboardFileNames()}>
                  {(parsedName: ParsedFileName, index: Accessor<number>) => (
                    <Switch>
                      <Match
                        when={
                          rightClickedClipboardFile() !== parsedName.fullName
                        }
                      >
                        <button
                          class={
                            "clipboard_file " +
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
                        when={
                          rightClickedClipboardFile() === parsedName.fullName
                        }
                      >
                        <div
                          class="clipboard_file_contextmenu"
                          onmouseleave={() => {
                            // Don't close if user is editing the name
                            if (
                              rightClickedClipboardFileNewName() !== null &&
                              rightClickedClipboardFileNewName() !==
                                rightClickedClipboardFile()
                            ) {
                              return;
                            }
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
                                    const clipboardIndex =
                                      clipboard().findIndex(
                                        (c) => c.name() === parsedName.fullName,
                                      );
                                    if (clipboardIndex !== -1) {
                                      onSaveClipboardFile(
                                        clipboardIndex,
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
                                        setIdbFileContent,
                                      );
                                    }
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
                                    const clipboardIndex =
                                      clipboard().findIndex(
                                        (c) => c.name() === parsedName.fullName,
                                      );
                                    if (clipboardIndex !== -1) {
                                      onDiscardClipboardFile(
                                        clipboardIndex,
                                        clipboard,
                                        setClipboard,
                                        viewedFile,
                                        setViewedFile,
                                        confirmAction,
                                        setConfirmAction,
                                        setRightClickedClipboardFile,
                                      ).then();
                                    }
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
                                    setRightClickedClipboardFile(null);
                                    setRightClickedClipboardFileNewName(null);
                                    setConfirmAction(null);
                                  }}
                                >
                                  <i class="bx bx-x"></i>
                                </button>
                                <button
                                  class="button_icon"
                                  onclick={(e) => {
                                    e.stopPropagation();
                                    onRenameClipboardFile(
                                      rightClickedClipboardFile(),
                                      rightClickedClipboardFileNewName(),
                                      clipboard,
                                    );
                                    setRightClickedClipboardFile(null);
                                    setRightClickedClipboardFileNewName(null);
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
          <div id="L_S_BOTTOM" class={directoryCollapsed() ? "collapsed" : ""}>
            <div
              class="filelist_header"
              onclick={() => setDirectoryCollapsed(!directoryCollapsed())}
            >
              <div class="left">
                <i
                  class={
                    "bx " +
                    (directoryCollapsed()
                      ? "bx-chevron-right"
                      : "bx-chevron-down")
                  }
                ></i>
                <i class="bx bx-folder-open"></i>
                <span>Directory</span>
              </div>
              <div class="right"></div>
            </div>
            <Show when={!directoryCollapsed()}>
              <Show
                when={
                  hoveredDirectoryFileNames() ||
                  filteredParsedDirectoryFileNames() !== null
                }
              >
                <div id="L_S_DIRECTORY">
                  <For
                    each={
                      hoveredDirectoryFileNames()
                        ? hoveredDirectoryFileNames()
                        : filteredParsedDirectoryFileNames()
                    }
                  >
                    {(parsedName: ParsedFileName, index: Accessor<number>) => (
                      <Switch>
                        <Match
                          when={rightClickedSavedFile() !== parsedName.fullName}
                        >
                          <button
                            class={
                              "saved_file " +
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
                                  clipboard,
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
                            class="saved_file_contextmenu"
                            onmouseleave={() => {
                              // Don't close if user is editing the name
                              if (
                                rightClickedSavedFileNewName() !== null &&
                                rightClickedSavedFileNewName() !==
                                  rightClickedSavedFile()
                              ) {
                                return;
                              }
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
                                      (confirmAction() ===
                                      ConfirmAction.TrashFile
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
                                      setRightClickedSavedFile(null);
                                      setRightClickedSavedFileNewName(null);
                                      setConfirmAction(null);
                                    }}
                                  >
                                    <i class="bx bx-x"></i>
                                  </button>
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
                                      setRightClickedSavedFile(null);
                                      setRightClickedSavedFileNewName(null);
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
            </Show>
          </div>
        </div>
      </div>
      <div id="CENTER">
        <div id="CENTRAL_HEADER">
          <div class="central_header_side">
            <div class="central_header_filename">{viewedFile()?.fileName}</div>
          </div>
          <div class="central_header_side">
            <For each={appModes}>
              {(am) => {
                return (
                  <button
                    onclick={() => {
                      setFileViewerMode(am.mode);
                      localStorage.setItem(localStorageFileViewerMode, am.mode);
                    }}
                    class={
                      "button_icon" +
                      (fileViewerMode() === am.mode ? " active" : "")
                    }
                  >
                    <i class={"bx " + am.icon}></i>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
        <Switch>
          <Match when={fileViewerMode() === FileViewerMode.AiWriter}>
            <Show when={viewedFile()} fallback={<div id="CODEMIRROR_EDITOR" />}>
              <CodeMirrorEditor
                content={displayedFileContent}
                onInput={(value) => handleTextareaInput(value)}
                enableMarkdown={
                  !!viewedFile() &&
                  parseFileName(viewedFile()!.fileName).ext.startsWith(".md")
                }
                inputValue={inputValue}
                setInputValue={setInputValue}
                filteredClipboardFileNames={filteredParsedClipboardFileNames}
                filteredDirectoryFileNames={filteredParsedDirectoryFileNames}
                onSave={async () => {
                  const entry = currentClipboardEntry();
                  if (entry) {
                    const index = clipboard().indexOf(entry);
                    if (index !== -1) {
                      await onSaveClipboardFile(
                        index,
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
                        setIdbFileContent,
                      );
                    }
                  }
                }}
              />
            </Show>
          </Match>
          <Match when={fileViewerMode() === FileViewerMode.MdReader}>
            <MdReader
              content={displayedFileContent}
              clipboard={clipboard}
              activeDirectoryName={activeDirectoryName}
              setViewedFile={setViewedFile}
            />
          </Match>
          <Match when={fileViewerMode() === FileViewerMode.Settings}>
            {SettingsComponent(
              ollamaConnection,
              setOllamaConnection,
              ollamaModel,
              setOllamaModel,
              ollamaSummaryModel,
              setOllamaSummaryModel,
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
              fileViewerMode() === FileViewerMode.AiWriter ||
              fileViewerMode() === FileViewerMode.MdReader
            }
          >
            <input
              id="CENTRAL_PROMPT_INPUT"
              class={bracketMode() ? "bracket-active" : ""}
              value={userPrompt()}
              onInput={(e) => {
                const value = e.currentTarget.value;
                const cursorPos =
                  e.currentTarget.selectionStart ?? value.length;
                setUserPrompt(value);
                const query = extractBracketQuery(value, cursorPos);
                if (query !== null) {
                  setBracketMode(true);
                  setInputValue(query);
                } else if (bracketMode()) {
                  setBracketMode(false);
                  setInputValue("");
                }
              }}
              onKeyDown={handleCentralInputKeyDown}
              onKeyUp={handleCentralInputKeyUp}
              placeholder="Enter prompt..."
            />
          </Match>
        </Switch>
      </div>
      <div id="RIGHT_SIDE">
        <Switch>
          <Match when={rightSidebarMode() === RightSidebarMode.AiWriter}>
            <AiWriter
              displayedFileContent={displayedFileContent}
              displayedFileName={displayedFileName}
              activeDirectoryParsedFileNames={activeDirectoryParsedFileNames}
              activeDirectoryName={activeDirectoryName}
              promptState={promptState}
              setReducedFileContent={setReducedFileContent}
              setReferencedFilesContents={setReferencedFilesContents}
              setReferencedTagFileContents={setReferencedTagFileContents}
              onGenerateSummary={handleSummaryGenerate}
            />
          </Match>
          <Match when={rightSidebarMode() === RightSidebarMode.TestBench}>
            <TestBench></TestBench>
          </Match>
        </Switch>
        <div id="RIGHT_TOOLBAR">
          <button
            class={
              "button_icon" +
              (rightSidebarMode() === RightSidebarMode.AiWriter
                ? " active"
                : "")
            }
            onclick={() => {
              setRightSidebarMode(RightSidebarMode.AiWriter);
              localStorage.setItem(
                localStorageRightSidebarMode,
                RightSidebarMode.AiWriter,
              );
            }}
          >
            <i class="bx bxs-edit"></i>
          </button>
          <button
            class={
              "button_icon" +
              (rightSidebarMode() === RightSidebarMode.TestBench
                ? " active"
                : "")
            }
            onclick={() => {
              setRightSidebarMode(RightSidebarMode.TestBench);
              localStorage.setItem(
                localStorageRightSidebarMode,
                RightSidebarMode.TestBench,
              );
            }}
          >
            <i class="bx bx-test-tube"></i>
          </button>
        </div>
      </div>
      <div id="RIGHT_SIDE_BUTTONS">
        <Switch
          fallback={
            <button
              class="user_action"
              title="Read from and write to the active file"
              onClick={handlePromptSubmit}
            >
              Continue Text
              <i class="bx bx-play-circle" />
            </button>
          }
        >
          <Match when={promptLoading()}>
            <button class="user_action" disabled>
              Loading
              <i class="bx bx-loader-alt bx-spin" />
            </button>
          </Match>
          <Match when={runningPrompt() !== null}>
            <button
              class="user_action yellow_border"
              onClick={() => runningPrompt()?.abort()}
            >
              Abort
              <i class="bx bx-block yellow_dim" />
            </button>
          </Match>
        </Switch>
        <button
          class="user_action fixed_width_icon"
          title="Have the LLM think about the active file"
          disabled={promptLoading() || runningPrompt() !== null}
          onClick={handleThinkSubmit}
        >
          <i class="bx bx-network-chart" />
        </button>
      </div>
    </div>
  );
}

export default App;
