import "./centerPanel.component.css";
import { Accessor, createMemo, For, JSXElement, Match, onCleanup, Setter, Show, Switch } from "solid-js";
import { FileViewerMode } from "../types/fileViewerMode.enum";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { parseFileName } from "../functions/parseFileName.function";
import { extractBracketQuery } from "../functions/extractBracketQuery.function";
import { AppMode } from "../constants/appModes";
import { localStorageFileViewerMode } from "../constants/storageKeys";
import { CodeMirrorEditor } from "./codeMirrorEditor.component";
import { MdReader } from "./mdReader.component";
import { PipelineOutput } from "./pipelineOutput.component";
import { PipelineInstance } from "../hooks/usePipelineState";

export interface CenterPanelProps {
  // View mode
  fileViewerMode: Accessor<FileViewerMode>;
  setFileViewerMode: Setter<FileViewerMode>;
  availableModes: Accessor<AppMode[]>;

  // File data
  viewedFile: Accessor<ViewedFile | null>;
  displayedFileContent: Accessor<string>;

  // Editor callbacks
  onTextareaInput: (value: string) => void;
  onSave: () => Promise<void>;

  // Search/autocomplete
  inputValue: Accessor<string>;
  setInputValue: Setter<string>;
  filteredParsedClipboardFileNames: Accessor<ParsedFileName[]>;
  filteredParsedDirectoryFileNames: Accessor<ParsedFileName[] | null>;

  // Prompt input
  userPrompt: Accessor<string>;
  setUserPrompt: Setter<string>;
  bracketMode: Accessor<boolean>;
  setBracketMode: Setter<boolean>;
  onCentralInputKeyDown: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
  onCentralInputKeyUp: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;

  // MdReader
  clipboard: Accessor<ClipboardEntry[]>;
  activeDirectoryName: Accessor<string | null>;
  setViewedFile: Setter<ViewedFile | null>;

  // Image viewer
  displayedFileBlob: Accessor<Blob | null>;

  // Pipeline output
  pipeline: Accessor<PipelineInstance>;
  pipelines: Accessor<PipelineInstance[]>;
  onAbortSubPipeline: (pipelineId: string) => void;
}

export function CenterPanel(props: CenterPanelProps): JSXElement {
  const imageObjectUrl = createMemo<string | null>(() => {
    const blob = props.displayedFileBlob();
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  // For SVG files viewed in ImageViewer mode, build a blob URL from the text content
  const svgObjectUrl = createMemo<string | null>(() => {
    if (props.fileViewerMode() !== FileViewerMode.ImageViewer) return null;
    const vf = props.viewedFile();
    if (!vf || parseFileName(vf.fileName).ext !== ".svg") return null;
    const content = props.displayedFileContent();
    if (!content) return null;
    const blob = new Blob([content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    onCleanup(() => URL.revokeObjectURL(url));
    return url;
  });

  const displayedImageUrl = createMemo<string | null>(
    () => imageObjectUrl() ?? svgObjectUrl(),
  );

  return (
    <div id="CENTER">
      <div id="CENTRAL_HEADER">
        <div class="central_header_side">
          <div class="central_header_filename">
            {props.viewedFile()?.fileName}
          </div>
        </div>
        <div class="central_header_side">
          <For each={props.availableModes()}>
            {(am) => {
              return (
                <button
                  onclick={() => {
                    props.setFileViewerMode(am.mode);
                    localStorage.setItem(localStorageFileViewerMode, am.mode);
                  }}
                  class={
                    "button_icon" +
                    (props.fileViewerMode() === am.mode ? " active" : "")
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
        <Match when={props.fileViewerMode() === FileViewerMode.AiWriter}>
          <Show
            when={props.viewedFile()}
            fallback={<div id="CODEMIRROR_EDITOR" />}
          >
            <CodeMirrorEditor
              content={props.displayedFileContent}
              onInput={(value) => props.onTextareaInput(value)}
              language={(() => {
                const vf = props.viewedFile();
                if (!vf) return null;
                const ext = parseFileName(vf.fileName).ext;
                if (ext.startsWith(".md")) return "md";
                if (ext === ".svg") return "xml";
                return null;
              })()}
              inputValue={props.inputValue}
              setInputValue={props.setInputValue}
              filteredClipboardFileNames={props.filteredParsedClipboardFileNames}
              filteredDirectoryFileNames={props.filteredParsedDirectoryFileNames}
              onSave={props.onSave}
            />
          </Show>
        </Match>
        <Match when={props.fileViewerMode() === FileViewerMode.MdReader}>
          <MdReader
            content={props.displayedFileContent}
            clipboard={props.clipboard}
            activeDirectoryName={props.activeDirectoryName}
            setViewedFile={props.setViewedFile}
          />
        </Match>
        <Match when={props.fileViewerMode() === FileViewerMode.ImageViewer}>
          <div id="IMAGE_VIEWER">
            <Show when={displayedImageUrl()}>
              <img src={displayedImageUrl()!} alt={props.viewedFile()?.fileName ?? "image"} />
            </Show>
          </div>
        </Match>
      </Switch>
      <Show when={props.pipeline().modelOutput() || props.pipeline().modelThoughts()}>
        <PipelineOutput
          pipeline={props.pipeline}
          pipelines={props.pipelines}
          onAbortSubPipeline={props.onAbortSubPipeline}
        />
      </Show>
      <input
        id="CENTRAL_PROMPT_INPUT"
        class={props.bracketMode() ? "bracket-active" : ""}
        value={props.userPrompt()}
        onInput={(e) => {
          const value = e.currentTarget.value;
          const cursorPos =
            e.currentTarget.selectionStart ?? value.length;
          props.setUserPrompt(value);
          const query = extractBracketQuery(value, cursorPos);
          if (query !== null) {
            props.setBracketMode(true);
            props.setInputValue(query);
          } else if (props.bracketMode()) {
            props.setBracketMode(false);
            props.setInputValue("");
          }
        }}
        onKeyDown={props.onCentralInputKeyDown}
        onKeyUp={props.onCentralInputKeyUp}
        placeholder="Enter prompt..."
      />
    </div>
  );
}
