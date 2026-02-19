import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Switch,
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

import {
  onSaveClipboardFile,
  onInputKeyUp,
  onUpdateDirectory,
  getOrCreateEditableFile,
  ensureEmptyClipboardFile,
} from "./app-handlers";
import { useOllamaConnection } from "./hooks/useOllamaConnection";

import { resolveNodeMessages } from "./functions/llm/resolveNodeMessages.function";
import { NodePipeline } from "./components/nodePipeline.component";
import { usePipelineManager } from "./hooks/usePipelineState";
import {
  localStorageChatUserPrompt,
  localStorageActiveDirectoryName,
  localStorageFileViewerMode,
  localStorageRightSidebarMode,
} from "./constants/storageKeys";
import { RightSidebarMode } from "./types/rightSidebarMode.enum";
import { TestBench } from "./components/testBench.component";
import { extractBracketQuery } from "./functions/extractBracketQuery.function";
import { longestCommonPrefix } from "./functions/longestCommonPrefix.function";

import { LeftSidebar } from "./components/leftSidebar.component";
import { LeftToolbar } from "./components/leftToolbar.component";
import { CenterPanel } from "./components/centerPanel.component";

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
  // Ollama connection
  // ============================================
  const {
    ollamaConnection,
    setOllamaConnection,
    ollamaUrl,
    setOllamaUrl,
    ollamaModels,
    setOllamaModels,
    ollamaModel,
    setOllamaModel,
    ollamaSummaryModel,
    setOllamaSummaryModel,
  } = useOllamaConnection();

  // ============================================
  // Prompt / pipeline state
  // ============================================
  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
  );

  // Pipeline manager (multiple pipelines)
  const pipelineMgr = usePipelineManager();

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
  createEffect(() => {
    localStorage.setItem(localStorageChatUserPrompt, userPrompt());
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
  // LLM pipeline handler
  // ============================================
  async function handlePipelineSubmit() {
    const ollama = ollamaConnection();
    const model = ollamaModel();

    if (!ollama || !model) {
      console.warn("Cannot submit pipeline: missing ollama or model");
      return;
    }

    // Capture the active pipeline at submit time so it streams to the right instance
    const p = pipelineMgr.activePipeline();

    const messages = await resolveNodeMessages({
      nodes: p.messageNodes(),
      directInputValue: userPrompt(),
      clipboard: clipboard(),
      activeDirectoryName: activeDirectoryName(),
    });

    if (messages.length === 0) {
      console.warn("Cannot submit pipeline: no messages resolved");
      return;
    }

    // Clear previous output
    p.setModelOutput("");
    p.setModelThoughts("");

    const request = {
      model: model.model,
      stream: true as const,
      think: true,
      messages,
    };

    try {
      p.setPromptLoading(true);
      const responseStream = await ollama.chat(request);
      p.setPromptLoading(false);
      p.setRunningPrompt(responseStream);

      let hasReceivedThinking = false;

      for await (const response of responseStream) {
        if (response.message.thinking) {
          if (!hasReceivedThinking) {
            p.setModelThoughts("");
            hasReceivedThinking = true;
          }
          p.setModelThoughts((prev) => prev + response.message.thinking);
        }
        if (response.message.content) {
          p.setModelOutput((prev) => prev + response.message.content);
        }
        if (response.done) {
          p.setRunningPrompt(null);
        }
      }
    } catch (error: unknown) {
      const isThinkingError =
        error instanceof Error &&
        (error.message.includes("400") ||
          error.message.toLowerCase().includes("think"));

      if (isThinkingError) {
        // Retry without thinking
        p.setModelOutput("");
        try {
          p.setPromptLoading(true);
          const responseStream = await ollama.chat({
            model: model.model,
            stream: true as const,
            messages,
          });
          p.setPromptLoading(false);
          p.setRunningPrompt(responseStream);

          for await (const response of responseStream) {
            if (response.message.content) {
              p.setModelOutput((prev) => prev + response.message.content);
            }
            if (response.done) {
              p.setRunningPrompt(null);
            }
          }
        } catch (retryError) {
          p.setPromptLoading(false);
          p.setRunningPrompt(null);
          console.error("Error processing chat response:", retryError);
        }
      } else {
        p.setPromptLoading(false);
        p.setRunningPrompt(null);
        console.error("Error processing chat response:", error);
      }
    }
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
      handlePipelineSubmit();
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
        <LeftToolbar
          directoryNames={directoryNames}
          setDirectoryNames={setDirectoryNames}
          activeDirectoryName={activeDirectoryName}
          setActiveDirectoryName={setActiveDirectoryName}
          rightClickedDirectory={rightClickedDirectory}
          setRightClickedDirectory={setRightClickedDirectory}
          hoveredDirectoryName={hoveredDirectoryName}
          setHoveredDirectoryName={setHoveredDirectoryName}
        />
        <LeftSidebar
          clipboardCollapsed={clipboardCollapsed}
          setClipboardCollapsed={setClipboardCollapsed}
          filteredParsedClipboardFileNames={filteredParsedClipboardFileNames}
          clipboard={clipboard}
          setClipboard={setClipboard}
          viewedFile={viewedFile}
          setViewedFile={setViewedFile}
          rightClickedClipboardFile={rightClickedClipboardFile}
          setRightClickedClipboardFile={setRightClickedClipboardFile}
          rightClickedClipboardFileNewName={rightClickedClipboardFileNewName}
          setRightClickedClipboardFileNewName={
            setRightClickedClipboardFileNewName
          }
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          directoryNames={directoryNames}
          setDirectoryNames={setDirectoryNames}
          activeDirectoryParsedFileNames={activeDirectoryParsedFileNames}
          setActiveDirectoryParsedFileNames={setActiveDirectoryParsedFileNames}
          activeDirectoryName={activeDirectoryName}
          setIdbFileContent={setIdbFileContent}
          directoryCollapsed={directoryCollapsed}
          setDirectoryCollapsed={setDirectoryCollapsed}
          hoveredDirectoryFileNames={hoveredDirectoryFileNames}
          hoveredDirectoryName={hoveredDirectoryName}
          filteredParsedDirectoryFileNames={filteredParsedDirectoryFileNames}
          rightClickedSavedFile={rightClickedSavedFile}
          setRightClickedSavedFile={setRightClickedSavedFile}
          rightClickedSavedFileNewName={rightClickedSavedFileNewName}
          setRightClickedSavedFileNewName={setRightClickedSavedFileNewName}
        />
      </div>
      <CenterPanel
        fileViewerMode={fileViewerMode}
        setFileViewerMode={setFileViewerMode}
        viewedFile={viewedFile}
        displayedFileContent={displayedFileContent}
        onTextareaInput={handleTextareaInput}
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
        inputValue={inputValue}
        setInputValue={setInputValue}
        filteredParsedClipboardFileNames={filteredParsedClipboardFileNames}
        filteredParsedDirectoryFileNames={filteredParsedDirectoryFileNames}
        userPrompt={userPrompt}
        setUserPrompt={setUserPrompt}
        bracketMode={bracketMode}
        setBracketMode={setBracketMode}
        onCentralInputKeyDown={handleCentralInputKeyDown}
        onCentralInputKeyUp={handleCentralInputKeyUp}
        clipboard={clipboard}
        activeDirectoryName={activeDirectoryName}
        setViewedFile={setViewedFile}
        ollamaConnection={ollamaConnection}
        setOllamaConnection={setOllamaConnection}
        ollamaModel={ollamaModel}
        setOllamaModel={setOllamaModel}
        ollamaSummaryModel={ollamaSummaryModel}
        setOllamaSummaryModel={setOllamaSummaryModel}
        ollamaModels={ollamaModels}
        setOllamaModels={setOllamaModels}
        ollamaUrl={ollamaUrl}
        setOllamaUrl={setOllamaUrl}
      />
      <div id="RIGHT_SIDE">
        <Switch>
          <Match when={rightSidebarMode() === RightSidebarMode.AiWriter}>
            <NodePipeline
              messageNodes={() => pipelineMgr.activePipeline().messageNodes()}
              onUpdateNode={pipelineMgr.updateNode}
              onRemoveNode={pipelineMgr.removeNode}
              onMoveNode={pipelineMgr.moveNode}
              ollamaNodeCollapsed={() =>
                pipelineMgr.activePipeline().ollamaNodeCollapsed()
              }
              setOllamaNodeCollapsed={(v) => {
                const val =
                  typeof v === "function"
                    ? v(pipelineMgr.activePipeline().ollamaNodeCollapsed())
                    : v;
                pipelineMgr.activePipeline().setOllamaNodeCollapsed(() => val);
              }}
              ollamaUrl={ollamaUrl}
              setOllamaUrl={setOllamaUrl}
              ollamaModels={ollamaModels}
              ollamaModel={ollamaModel}
              setOllamaModel={setOllamaModel}
              promptLoading={() => pipelineMgr.activePipeline().promptLoading()}
              runningPrompt={() => pipelineMgr.activePipeline().runningPrompt()}
              onSubmit={handlePipelineSubmit}
              modelThoughts={() => pipelineMgr.activePipeline().modelThoughts()}
              modelOutput={() => pipelineMgr.activePipeline().modelOutput()}
              clipboard={clipboard}
              activeDirectoryParsedFileNames={activeDirectoryParsedFileNames}
            />
          </Match>
          <Match when={rightSidebarMode() === RightSidebarMode.TestBench}>
            <TestBench></TestBench>
          </Match>
        </Switch>
        <div id="RIGHT_TOOLBAR">
          <For each={pipelineMgr.pipelines()}>
            {(p, index) => (
              <button
                class={
                  "button_icon pipeline_btn" +
                  (pipelineMgr.activePipelineId() === p.id ? " active" : "") +
                  (p.runningPrompt() !== null ? " running" : "")
                }
                onclick={() => pipelineMgr.setActivePipelineId(p.id)}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  if (pipelineMgr.pipelines().length > 1) {
                    pipelineMgr.removePipeline(p.id);
                  }
                }}
                title={`Pipeline ${index() + 1}${p.runningPrompt() !== null ? " (running)" : ""} — right-click to remove`}
              >
                {index() + 1}
              </button>
            )}
          </For>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addPipeline()}
            title="Add pipeline"
          >
            <i class="bx bx-plus"></i>
          </button>
          <div class="toolbar_spacer" />
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
          <div class="toolbar_spacer" />
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addNode("system")}
            title="Add System node"
          >
            <i class="bx bx-info-circle"></i>
          </button>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addNode("assistant")}
            title="Add Assistant node"
          >
            <i class="bx bx-bot"></i>
          </button>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addNode("user")}
            title="Add User node"
          >
            <i class="bx bxs-user-voice"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
