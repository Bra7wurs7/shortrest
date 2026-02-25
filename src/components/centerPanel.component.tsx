import { Accessor, For, JSXElement, Match, Setter, Show, Switch } from "solid-js";
import { FileViewerMode } from "../types/fileViewerMode.enum";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { parseFileName } from "../functions/parseFileName.function";
import { extractBracketQuery } from "../functions/extractBracketQuery.function";
import { appModes } from "../constants/appModes";
import { localStorageFileViewerMode } from "../constants/storageKeys";
import { CodeMirrorEditor } from "./codeMirrorEditor.component";
import { MdReader } from "./mdReader.component";

export interface CenterPanelProps {
  // View mode
  fileViewerMode: Accessor<FileViewerMode>;
  setFileViewerMode: Setter<FileViewerMode>;

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
}

export function CenterPanel(props: CenterPanelProps): JSXElement {
  return (
    <div id="CENTER">
      <div id="CENTRAL_HEADER">
        <div class="central_header_side">
          <div class="central_header_filename">
            {props.viewedFile()?.fileName}
          </div>
        </div>
        <div class="central_header_side">
          <For each={appModes}>
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
              enableMarkdown={
                !!props.viewedFile() &&
                parseFileName(props.viewedFile()!.fileName).ext.startsWith(
                  ".md",
                )
              }
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
      </Switch>
      <Switch>
        <Match
          when={
            props.fileViewerMode() === FileViewerMode.AiWriter ||
            props.fileViewerMode() === FileViewerMode.MdReader
          }
        >
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
        </Match>
      </Switch>
    </div>
  );
}
