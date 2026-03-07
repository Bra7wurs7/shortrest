import { Accessor, For, JSXElement, Match, Setter, Switch } from "solid-js";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ConfirmAction } from "../types/confirmAction.enum";
import {
  onClickClipboardFile,
  onClickDownloadClipboardFile,
  onSaveClipboardFile,
  onDiscardClipboardFile,
  onInputExistingFileName,
  onRenameClipboardFile,
} from "../app-handlers";

export interface ClipboardFileEntryProps {
  parsedName: ParsedFileName;
  viewedFile: Accessor<ViewedFile | null>;
  clipboard: Accessor<ClipboardEntry[]>;
  setClipboard: Setter<ClipboardEntry[]>;
  setViewedFile: Setter<ViewedFile | null>;
  rightClickedFile: Accessor<string | null>;
  setRightClickedFile: Setter<string | null>;
  rightClickedFileNewName: Accessor<string | null>;
  setRightClickedFileNewName: Setter<string | null>;
  confirmAction: Accessor<ConfirmAction | null>;
  setConfirmAction: Setter<ConfirmAction | null>;
  directoryNames: Accessor<string[]>;
  setDirectoryNames: Setter<string[]>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  setActiveDirectoryParsedFileNames: Setter<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  setIdbFileContent: Setter<string>;
}

export function ClipboardFileEntry(props: ClipboardFileEntryProps): JSXElement {
  const name = props.parsedName;

  return (
    <Switch>
      <Match when={props.rightClickedFile() !== name.fullName}>
        <button
          class={
            "clipboard_file " +
            (props.viewedFile()?.source === "clipboard" &&
            props.viewedFile()?.fileName === name.fullName
              ? "active "
              : "") +
            (props.rightClickedFile() === name.fullName ? "context_menu" : "")
          }
          onclick={() => {
            onClickClipboardFile(name.fullName, props.setViewedFile);
          }}
          oncontextmenu={(e: PointerEvent) => {
            e.preventDefault();
            props.setRightClickedFile(name.fullName);
          }}
        >
          <div class="filename bg">
            <Switch>
              <Match when={name.baseName}>
                <i class="bx bxs-file"></i>
              </Match>
              <Match when={name.baseName === ""}>
                <i class="bx bxs-tag-alt"></i>
              </Match>
            </Switch>
            {name.baseName}
          </div>
          <div class="tags">
            <For each={name.tags}>
              {(tag: string) => <span>&nbsp;{tag}</span>}
            </For>
          </div>
        </button>
      </Match>
      <Match when={props.rightClickedFile() === name.fullName}>
        <div
          class="clipboard_file_contextmenu"
          onmouseleave={() => {
            if (
              props.rightClickedFileNewName() !== null &&
              props.rightClickedFileNewName() !== props.rightClickedFile()
            ) {
              return;
            }
            props.setRightClickedFile(null);
            props.setRightClickedFileNewName(null);
            props.setConfirmAction(null);
          }}
          onClick={() => {
            props.setRightClickedFile(null);
          }}
        >
          <div
            class="filename text_overflow_fade bg"
            contenteditable
            onclick={(e) => {
              e.stopPropagation();
            }}
            oninput={(e) => {
              onInputExistingFileName(e, props.setRightClickedFileNewName);
            }}
          >
            {name.fullName ?? "unnamed file"}
          </div>
          <div class="actions">
            <Switch>
              <Match
                when={
                  props.rightClickedFileNewName() === null ||
                  props.rightClickedFile() === props.rightClickedFileNewName()
                }
              >
                <button
                  class="button_icon"
                  onclick={(e) => {
                    e.stopPropagation();
                    onClickDownloadClipboardFile(
                      props.clipboard,
                      name.fullName,
                    );
                  }}
                >
                  <i class="bx bxs-download"></i>
                </button>
                <button
                  class="button_icon"
                  onclick={(e) => {
                    e.stopImmediatePropagation();
                    const clipboardIndex = props
                      .clipboard()
                      .findIndex((c) => c.name() === name.fullName);
                    if (clipboardIndex !== -1) {
                      onSaveClipboardFile(
                        clipboardIndex,
                        props.clipboard,
                        props.setClipboard,
                        props.directoryNames,
                        props.setDirectoryNames,
                        props.activeDirectoryParsedFileNames,
                        props.setActiveDirectoryParsedFileNames,
                        props.activeDirectoryName,
                        props.viewedFile,
                        props.setViewedFile,
                        props.setRightClickedFile,
                        props.setIdbFileContent,
                      );
                    }
                  }}
                >
                  <i class="bx bx-save"></i>
                </button>
                <button
                  class={
                    "button_icon " +
                    (props.confirmAction() === ConfirmAction.DiscardChanges
                      ? "orange"
                      : "")
                  }
                  onclick={(e) => {
                    e.stopImmediatePropagation();
                    const clipboardIndex = props
                      .clipboard()
                      .findIndex((c) => c.name() === name.fullName);
                    if (clipboardIndex !== -1) {
                      onDiscardClipboardFile(
                        clipboardIndex,
                        props.clipboard,
                        props.setClipboard,
                        props.viewedFile,
                        props.setViewedFile,
                        props.confirmAction,
                        props.setConfirmAction,
                        props.setRightClickedFile,
                      ).then();
                    }
                  }}
                >
                  <i class="bx bx-x-circle"></i>
                </button>
              </Match>
              <Match
                when={
                  props.rightClickedFile() !== props.rightClickedFileNewName()
                }
              >
                <button
                  class="button_icon"
                  onclick={(e) => {
                    e.stopPropagation();
                    props.setRightClickedFile(null);
                    props.setRightClickedFileNewName(null);
                    props.setConfirmAction(null);
                  }}
                >
                  <i class="bx bx-x"></i>
                </button>
                <button
                  class="button_icon"
                  onclick={(e) => {
                    e.stopPropagation();
                    onRenameClipboardFile(
                      props.rightClickedFile(),
                      props.rightClickedFileNewName(),
                      props.clipboard,
                      props.viewedFile,
                      props.setViewedFile,
                    );
                    props.setRightClickedFile(null);
                    props.setRightClickedFileNewName(null);
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
  );
}
