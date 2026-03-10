import { Accessor, For, JSXElement, Match, Setter, Switch } from "solid-js";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ConfirmAction } from "../types/confirmAction.enum";
import {
  createClipboardView,
  onClickDownloadClipboardFile,
  saveClipboardFile,
  discardClipboardFile,
  onInputExistingFileName,
  renameClipboardFile,
} from "../app-handlers";
import { getFileIcon } from "../functions/fileIcon.function";

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
            props.setViewedFile(createClipboardView(name.fullName));
          }}
          oncontextmenu={(e: PointerEvent) => {
            e.preventDefault();
            props.setRightClickedFile(name.fullName);
          }}
        >
          <div class="filename bg">
            <i class={"bx " + getFileIcon(name.baseName, name.ext)}></i>
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
              props.setRightClickedFileNewName(onInputExistingFileName(e));
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
                      props.clipboard(),
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
                    const entry = props
                      .clipboard()
                      .find((c) => c.name === name.fullName);
                    if (entry) {
                      saveClipboardFile(
                        entry,
                        props.clipboard(),
                        props.activeDirectoryName(),
                        props.activeDirectoryParsedFileNames(),
                        props.viewedFile(),
                      ).then((result) => {
                        props.setClipboard(result.clipboard);
                        props.setActiveDirectoryParsedFileNames(result.dirFileNames);
                        props.setViewedFile(result.viewedFile);
                        if (result.idbFileContent !== null) {
                          props.setIdbFileContent(result.idbFileContent);
                        }
                        props.setRightClickedFile(null);
                      });
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
                      .findIndex((c) => c.name === name.fullName);
                    if (clipboardIndex !== -1) {
                      const result = discardClipboardFile(
                        clipboardIndex,
                        props.clipboard(),
                        props.viewedFile(),
                        props.confirmAction(),
                      );
                      if (result) {
                        props.setClipboard(result.clipboard);
                        props.setViewedFile(result.viewedFile);
                        props.setConfirmAction(result.confirmAction);
                        if (result.clearRightClick) {
                          props.setRightClickedFile(null);
                        }
                      }
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
                    const result = renameClipboardFile(
                      props.rightClickedFile()!,
                      props.rightClickedFileNewName()!,
                      props.clipboard(),
                      props.viewedFile(),
                    );
                    if (result) {
                      props.setClipboard(result.clipboard);
                      props.setViewedFile(result.viewedFile);
                    }
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
