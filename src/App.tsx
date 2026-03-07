import "./App.css";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
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
  removeFileFromDirectory,
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
import { useLLMConnection } from "./hooks/useLLMConnection";
import type { LLMAbortableStream } from "./types/llmProvider.interface";

import { resolveNodeMessages, findSubPipelineCycle } from "./functions/llm/resolveNodeMessages.function";
import { runWithTools } from "./functions/llm/runWithTools.function";
import { hasEnabledToolbelt, buildNativeToolDefinitions } from "./functions/llm/toolbeltExecutor.function";
import { NodePipeline } from "./components/nodePipeline.component";
import { usePipelineManager } from "./hooks/usePipelineState";
import {
  localStorageChatUserPrompt,
  localStorageActiveDirectoryName,
  localStorageFileViewerMode,
} from "./constants/storageKeys";
import { writeFileToDirectory } from "./functions/dbFilesInterface.functions";
import { extractBracketQuery } from "./functions/extractBracketQuery.function";
import { longestCommonPrefix } from "./functions/longestCommonPrefix.function";
import { getModesForExt } from "./constants/appModes";

import { LeftSidebar } from "./components/leftSidebar.component";
import { LeftToolbar } from "./components/leftToolbar.component";
import { CenterPanel } from "./components/centerPanel.component";

/**
 * Returns a flush function that accumulates string chunks and applies them
 * to a setter at most once per animation frame, preventing per-token re-renders.
 * Call flush(chunk) to enqueue; the pending buffer is written on the next rAF.
 * Call flush.cancel() when the stream ends to immediately drain any remainder.
 */
function createRafAccumulator(
  setter: (updater: (prev: string) => string) => void,
): { (chunk: string): void; cancel: () => void } {
  let buffer = "";
  let rafId: number | null = null;

  function drain() {
    rafId = null;
    if (!buffer) return;
    const pending = buffer;
    buffer = "";
    setter((prev) => prev + pending);
  }

  function flush(chunk: string) {
    buffer += chunk;
    if (rafId === null) {
      rafId = requestAnimationFrame(drain);
    }
  }

  flush.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    drain();
  };

  return flush;
}

function App(): JSXElement {
  // ============================================
  // App-level signals
  // ============================================
  const [fileViewerMode, setFileViewerMode] = createSignal<FileViewerMode>(
    localStorage.getItem(localStorageFileViewerMode) as FileViewerMode,
  );
  const [pendingRemovePipelineId, setPendingRemovePipelineId] = createSignal<
    string | null
  >(null);
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
  // IDB file blob: set when the viewed IDB file is binary (e.g. generated image)
  const [idbFileBlob, setIdbFileBlob] = createSignal<Blob | null>(null);

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
  const [rightClickedDirectoryDelete, setRightClickedDirectoryDelete] =
    createSignal(false);
  const [hoveredDirectoryName, setHoveredDirectoryName] = createSignal<
    string | null
  >(null);
  const [clipboardCollapsed, setClipboardCollapsed] = createSignal(false);
  const [directoryCollapsed, setDirectoryCollapsed] = createSignal(false);

  // ============================================
  // LLM connection
  // ============================================
  const {
    llmProvider,
    llmProviderType,
    llmUrl,
    setLLMUrl,
    llmApiKey,
    setLLMApiKey,
    llmModels,
  } = useLLMConnection();

  // ============================================
  // Prompt / pipeline state
  // ============================================
  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
  );

  // Pipeline manager (multiple pipelines)
  const pipelineMgr = usePipelineManager();

  // Resolve each pipeline's model when the model list loads or when pipelines change
  createEffect(() => {
    const models = llmModels();
    pipelineMgr.pipelines(); // track pipeline list so new pipelines get resolved too
    if (models && models.length > 0) {
      pipelineMgr.resolveModels(models);
    }
  });

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

  // Blob content of the currently viewed IDB file (null for text files or clipboard)
  const displayedFileBlob = createMemo<Blob | null>(() => {
    const vf = viewedFile();
    if (vf?.source === "idb") return idbFileBlob();
    return null;
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

  // Viewer modes available for the currently viewed file type
  const availableModes = createMemo(() => {
    const vf = viewedFile();
    const ext = vf ? parseFileName(vf.fileName).ext : null;
    return getModesForExt(ext);
  });

  // ============================================
  // Effects - Persistence
  // ============================================
  createEffect(() => {
    localStorage.setItem(localStorageChatUserPrompt, userPrompt());
  });

  // Reset fileViewerMode when the current mode is not valid for the new file
  createEffect(() => {
    const modes = availableModes();
    const current = fileViewerMode();
    if (!modes.some((m) => m.mode === current)) {
      const next = modes[0].mode;
      setFileViewerMode(next);
      localStorage.setItem(localStorageFileViewerMode, next);
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
        if (content instanceof Blob) {
          setIdbFileBlob(content);
          setIdbFileContent("");
        } else {
          setIdbFileBlob(null);
          setIdbFileContent(content ?? "");
        }
      });
    } else if (vf?.source === "clipboard") {
      // Clear IDB content when viewing clipboard
      setIdbFileContent("");
      setIdbFileBlob(null);
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
  listAllDirectories()
    .then((names) => {
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
            localStorage.setItem(
              localStorageActiveDirectoryName,
              emptyDirectory,
            );
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
    })
    .catch((err) => {
      console.error("Failed to load directories on startup:", err);
    });

  // ============================================
  // LLM pipeline handler
  // ============================================
  async function handlePipelineSubmit() {
    const provider = llmProvider();

    // Capture the active pipeline at submit time so it streams to the right instance
    const p = pipelineMgr.activePipeline();

    const model = p.model();

    if (!provider || !model) {
      console.warn("Cannot submit pipeline: missing provider or model");
      return;
    }
    // Non-null aliases so TypeScript doesn't lose the narrowing in nested functions
    const providerNonNull = provider;
    const modelNonNull = model;

    // Reject cyclic sub-pipeline graphs before making any LLM calls.
    const cycle = findSubPipelineCycle(p.id, pipelineMgr.pipelines());
    if (cycle) {
      p.setModelOutput(
        `*Error: circular sub-pipeline reference — ${cycle.join(" → ")}*`,
      );
      return;
    }

    // Clear stale output from any sub-pipelines referenced by this pipeline's nodes
    // so that if a sub-pipeline doesn't run this time, its output area shows nothing.
    const allPipelines = pipelineMgr.pipelines();
    for (const node of p.messageNodes()) {
      if (
        node.acquisitionMode === "sub-pipeline" &&
        !node.disabled &&
        node.sourcePipelineId
      ) {
        const subP = allPipelines.find((q) => q.id === node.sourcePipelineId);
        if (subP) {
          subP.setModelOutput("");
          subP.setSubPipelineRunning(false);
        }
      }
    }

    // Extracted so the tool loop can re-resolve on every agent iteration.
    // A fresh cache is created per call so that within a single resolution pass
    // multiple nodes referencing the same sub-pipeline share one LLM request,
    // while separate agentic iterations each start clean.
    const resolveCurrentMessages = () => {
      const subPipelineCache = new Map<string, Promise<string>>();
      return resolveNodeMessages({
        nodes: p.messageNodes(),
        directInputValue: userPrompt(),
        clipboard: clipboard(),
        activeDirectoryName: activeDirectoryName(),
        displayedFileContent: displayedFileContent(),
        displayedFileBlob: displayedFileBlob(),
        pipelines: pipelineMgr.pipelines(),
        ownHistory: p.history(),
        provider,
        model,
        ownPipelineId: p.id,
        _subPipelineCache: subPipelineCache,
        onSubPipelineLoading: (pipelineId) => {
          const target = pipelineMgr.pipelines().find((p) => p.id === pipelineId);
          if (!target) return;
          target.setPromptLoading(true);
          target.setRunningPrompt(null);
        },
        onSubPipelineStateChange: (pipelineId, running, streamOrOutput) => {
          const target = pipelineMgr
            .pipelines()
            .find((p) => p.id === pipelineId);
          if (!target) return;
          target.setSubPipelineRunning(running);
          if (running) {
            // Stream has opened: transition from loading → running
            target.setPromptLoading(false);
            target.setRunningPrompt(streamOrOutput as LLMAbortableStream);
          } else {
            target.setPromptLoading(false);
            target.setRunningPrompt(null);
            target.setModelOutput(streamOrOutput as string);
          }
        },
      });
    };

    const messages = await resolveCurrentMessages();

    if (messages.length === 0) {
      console.warn("Cannot submit pipeline: no messages resolved");
      return;
    }

    // The last user-role message is what we record as the "user" side of the turn
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    function recordHistoryTurn(output: string) {
      if (lastUserMessage && output) {
        p.setHistory((prev) => [
          ...prev,
          { user: lastUserMessage, assistant: output },
        ]);
      }
    }

    // Clear previous output
    p.setModelOutput("");
    p.setModelThoughts("");

    const useToolLoop = hasEnabledToolbelt(p.messageNodes());

    let finalOutput = "";

    try {
      p.setPromptLoading(true);

      if (useToolLoop) {
        // Agentic tool-use loop
        const flushThoughts = createRafAccumulator(p.setModelThoughts);
        const accumulatedOutput = await runWithTools({
          provider,
          model,
          messages,
          tools: buildNativeToolDefinitions(p.messageNodes()),
          resolveMessages: resolveCurrentMessages,
          toolbeltCtx: {
            nodes: p.messageNodes(),
            clipboard: clipboard(),
            activeDirectoryName: activeDirectoryName(),
            viewedFileName: viewedFile()?.fileName ?? null,
            viewedFileContent: displayedFileContent(),
            viewedFileModified: viewedFile() === null ? null : viewedFile()!.source === "clipboard",
            viewedFileBlob: displayedFileBlob(),
            onAppendWorkspace: (appended) => {
              const vf = viewedFile();
              if (!vf || vf.source !== "clipboard") return;
              const entry = clipboard().find((c) => c.name() === vf.fileName);
              if (entry) {
                entry.setContent(entry.content() + appended);
                storeClipboard(clipboard);
              }
            },
            onOverwriteWorkspace: (content) => {
              const vf = viewedFile();
              if (!vf || vf.source !== "clipboard") return;
              const entry = clipboard().find((c) => c.name() === vf.fileName);
              if (entry) {
                entry.setContent(content);
                storeClipboard(clipboard);
              }
            },
            onCreateClipboardFile: (name, content) => {
              const existing = clipboard().find((e) => e.name() === name);
              if (existing) {
                existing.setContent(content);
              } else {
                const [nameAcc, setNameAcc] = createSignal(name);
                const [contentAcc, setContentAcc] = createSignal(content);
                const entry: ClipboardEntry = {
                  name: nameAcc, setName: setNameAcc,
                  content: contentAcc, setContent: setContentAcc,
                  originalName: name, originalContent: content,
                  sourceDirectory: null,
                };
                setClipboard((prev) => [...prev, entry]);
              }
              storeClipboard(clipboard);
            },
            onWriteFile: async (name, content) => {
              const dirName = activeDirectoryName();
              if (!dirName) return;
              await writeFileToDirectory(dirName, { name, content });
              const names = await listFileNamesInDirectory(dirName);
              setActiveDirectoryParsedFileNames(names.map((fn) => parseFileName(fn)));
            },
            onDeleteFile: async (name) => {
              const dirName = activeDirectoryName();
              if (!dirName) return;
              await removeFileFromDirectory(dirName, name);
              const names = await listFileNamesInDirectory(dirName);
              setActiveDirectoryParsedFileNames(names.map((fn) => parseFileName(fn)));
            },
            onRenameFile: async (oldName, newName) => {
              const dirName = activeDirectoryName();
              if (!dirName) return;
              const content = await getFileContent(dirName, oldName);
              if (content === null) return;
              await writeFileToDirectory(dirName, { name: newName, content });
              await removeFileFromDirectory(dirName, oldName);
              const names = await listFileNamesInDirectory(dirName);
              setActiveDirectoryParsedFileNames(names.map((fn) => parseFileName(fn)));
            },
            onImageGenerated: async (filename, blob) => {
              const dirName = activeDirectoryName();
              if (!dirName) return;
              await writeFileToDirectory(dirName, { name: filename, content: blob });
              const names = await listFileNamesInDirectory(dirName);
              setActiveDirectoryParsedFileNames(names.map((fn) => parseFileName(fn)));
              const newViewedFile: ViewedFile = {
                source: "idb",
                directoryName: dirName,
                fileName: filename,
              };
              setViewedFile(newViewedFile);
              storeViewedFile(newViewedFile);
            },
          },
          getClipboard: clipboard,
          onStream: (stream) => {
            p.setPromptLoading(false);
            p.setRunningPrompt(stream);
          },
          // Final turn: onChunk is called once with the complete output — no batching needed
          onChunk: (text) => {
            p.setModelOutput((prev) => prev + text);
          },
          onThinkChunk: flushThoughts,
          // Tool turns: append annotated output (call + inline result) as a block
          onToolTurnComplete: (annotated) => {
            p.setModelOutput((prev) => prev + annotated + "\n");
          },
        });
        flushThoughts.cancel();
        p.setRunningPrompt(null);
        finalOutput = accumulatedOutput;
        recordHistoryTurn(finalOutput);
      } else {
        // Standard single-shot stream (with think fallback)
        async function streamStandard(withThink: boolean): Promise<string> {
          const responseStream = await providerNonNull.chat({
            model: modelNonNull.id,
            stream: true as const,
            ...(withThink ? { think: true } : {}),
            messages,
          });
          p.setPromptLoading(false);
          p.setRunningPrompt(responseStream);

          const flushOutput = createRafAccumulator(p.setModelOutput);
          const flushThoughts = createRafAccumulator(p.setModelThoughts);

          let accumulatedOutput = "";
          let hasReceivedThinking = false;
          try {
            for await (const chunk of responseStream) {
              if (chunk.thinking) {
                if (!hasReceivedThinking) {
                  p.setModelThoughts("");
                  hasReceivedThinking = true;
                }
                flushThoughts(chunk.thinking);
              }
              if (chunk.content) {
                accumulatedOutput += chunk.content;
                flushOutput(chunk.content);
              }
            }
          } finally {
            flushOutput.cancel();
            flushThoughts.cancel();
          }
          return accumulatedOutput;
        }

        let accumulatedOutput: string;
        try {
          accumulatedOutput = await streamStandard(true);
        } catch (thinkErr: unknown) {
          const isThinkingError =
            thinkErr instanceof Error &&
            thinkErr.message.toLowerCase().includes("think");
          if (!isThinkingError) throw thinkErr;
          p.setModelOutput("");
          accumulatedOutput = await streamStandard(false);
        }
        p.setRunningPrompt(null);
        finalOutput = accumulatedOutput;
        recordHistoryTurn(finalOutput);
      }

    } catch (error: unknown) {
      p.setPromptLoading(false);
      p.setRunningPrompt(null);
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error processing chat response:", error);
      p.setModelOutput((prev) => prev + `\n\n*Error: ${message}*`);
      return;
    }

    // Auto-rerun if loop mode is enabled
    if (p.loopEnabled()) {
      handlePipelineSubmit();
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

      const allParsedMatches = [
        ...filteredParsedClipboardFileNames(),
        ...(filteredParsedDirectoryFileNames() ?? []),
      ];
      if (allParsedMatches.length === 0) return;

      const allFullNames = allParsedMatches.map((f) => f.fullName);
      const completion = longestCommonPrefix(allFullNames);
      if (completion.length <= query.length) return;

      const bracketStart = cursorPos - query.length;

      if (allParsedMatches.length === 1) {
        const match = allParsedMatches[0];
        const inserted = match.baseName + "](" + match.fullName + ")";
        const newValue =
          value.substring(0, bracketStart) +
          inserted +
          value.substring(cursorPos);
        setUserPrompt(newValue);
        setBracketMode(false);
        setInputValue("");
        requestAnimationFrame(() => {
          const pos = bracketStart + inserted.length;
          input.setSelectionRange(pos, pos);
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
          rightClickedDirectoryDelete={rightClickedDirectoryDelete}
          setRightClickedDirectoryDelete={setRightClickedDirectoryDelete}
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
        availableModes={availableModes}
        viewedFile={viewedFile}
        displayedFileContent={displayedFileContent}
        displayedFileBlob={displayedFileBlob}
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
        pipeline={pipelineMgr.activePipeline}
        pipelines={pipelineMgr.pipelines}
        onAbortSubPipeline={(pipelineId) => {
          const target = pipelineMgr.pipelines().find((p) => p.id === pipelineId);
          target?.runningPrompt()?.abort();
        }}
      />
      <div id="RIGHT_SIDE">
        <NodePipeline
          pipeline={pipelineMgr.activePipeline}
          onUpdateNode={pipelineMgr.updateNode}
          onRemoveNode={pipelineMgr.removeNode}
          onMoveNode={pipelineMgr.moveNode}
          llmUrl={llmUrl}
          setLLMUrl={setLLMUrl}
          llmApiKey={llmApiKey}
          setLLMApiKey={setLLMApiKey}
          llmProviderType={llmProviderType}
          llmModels={llmModels}
          onSubmit={handlePipelineSubmit}
          clipboard={clipboard}
          activeDirectoryParsedFileNames={activeDirectoryParsedFileNames}
          pipelines={pipelineMgr.pipelines}
        />
        <div id="RIGHT_TOOLBAR">
          <For each={pipelineMgr.pipelines()}>
            {(p, index) => (
              <button
                class={(() => {
                  const ownLoading = p.promptLoading() && p.runningPrompt() === null;
                  const subLoading = !ownLoading && p.messageNodes().some((n) => {
                    if (n.acquisitionMode !== "sub-pipeline" || n.disabled) return false;
                    const sub = pipelineMgr.pipelines().find((q) => q.id === n.sourcePipelineId);
                    return sub ? (sub.promptLoading() && sub.runningPrompt() === null) : false;
                  });
                  return (
                    "button_icon pipeline_btn" +
                    (pipelineMgr.activePipelineId() === p.id ? " active" : "") +
                    (ownLoading || subLoading ? " loading" : "") +
                    (p.runningPrompt() !== null ? " running" : "") +
                    (p.subPipelineRunning() ? " sub_running" : "") +
                    (pendingRemovePipelineId() === p.id ? " red" : "")
                  );
                })()}
                onclick={() => {
                  if (pendingRemovePipelineId() === p.id) {
                    if (pipelineMgr.pipelines().length > 1) {
                      pipelineMgr.removePipeline(p.id);
                    }
                    setPendingRemovePipelineId(null);
                  } else {
                    setPendingRemovePipelineId(null);
                    pipelineMgr.setActivePipelineId(p.id);
                  }
                }}
                oncontextmenu={(e) => {
                  e.preventDefault();
                  if (pipelineMgr.pipelines().length > 1) {
                    setPendingRemovePipelineId(p.id);
                  }
                }}
                onmouseleave={() => {
                  if (pendingRemovePipelineId() === p.id) {
                    setPendingRemovePipelineId(null);
                  }
                }}
                title={
                  pendingRemovePipelineId() === p.id
                    ? "Click to remove pipeline"
                    : `Pipeline ${index() + 1}${p.promptLoading() && p.runningPrompt() === null ? " (loading)" : ""}${p.runningPrompt() !== null ? " (running)" : ""}${p.subPipelineRunning() ? " (sub-pipeline running)" : ""} — right-click to remove`
                }
              >
                {pendingRemovePipelineId() === p.id ? (
                  <i class="bx bx-x" />
                ) : (
                  index() + 1
                )}
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
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addHistoryNode()}
            title="Add History node"
          >
            <i class="bx bx-history"></i>
          </button>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addFilesToolbeltNode()}
            title="Add Files toolbelt"
          >
            <i class="bx bx-folder"></i>
          </button>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addWorkspaceToolbeltNode()}
            title="Add Workspace toolbelt"
          >
            <i class="bx bx-edit"></i>
          </button>
          <button
            class="button_icon"
            onclick={() => pipelineMgr.addImageToolbeltNode()}
            title="Add Image toolbelt"
          >
            <i class="bx bx-image-alt"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
