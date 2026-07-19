import { Accessor, For, JSXElement, Match, Setter, Switch } from "solid-js";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ConfirmAction } from "../types/confirmAction.enum";
import {
  resolveFileView,
  onClickDownloadSavedFile,
  trashSavedFile,
  onInputExistingFileName,
  renameSavedFile,
  updateDirectories,
} from "../app-handlers";
import { getFileIcon } from "../functions/fileIcon.function";

export interface DirectoryFileEntryProps {
  parsedName: ParsedFileName;
  viewedFile: Accessor<ViewedFile | null>;
  clipboard: Accessor<ClipboardEntry[]>;
  setViewedFile: Setter<ViewedFile | null>;
  rightClickedFile: Accessor<string | null>;
  setRightClickedFile: Setter<string | null>;
  rightClickedFileNewName: Accessor<string | null>;
  setRightClickedFileNewName: Setter<string | null>;
  confirmAction: Accessor<ConfirmAction | null>;
  setConfirmAction: Setter<ConfirmAction | null>;
  activeDirectoryName: Accessor<string | null>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  setActiveDirectoryParsedFileNames: Setter<ParsedFileName[] | null>;
  directoryNames: Accessor<string[]>;
  setDirectoryNames: Setter<string[]>;
}

export function DirectoryFileEntry(props: DirectoryFileEntryProps): JSXElement {
  const name = props.parsedName;

  return (
    <Switch>
      <Match when={props.rightClickedFile() !== name.fullName}>
        <button
          class={
            "saved_file " +
            (props.viewedFile()?.source === "idb" &&
            props.viewedFile()?.fileName === name.fullName
              ? "active "
              : "") +
            (props.rightClickedFile() === name.fullName ? "context_menu" : "")
          }
          onclick={() => {
            const activeDirName = props.activeDirectoryName();
            if (activeDirName) {
              props.setViewedFile(
                resolveFileView(name.fullName, activeDirName, props.clipboard()),
              );
            }
          }}
          oncontextmenu={(e: PointerEvent) => {
            e.preventDefault();
            props.setRightClickedFile(name.fullName);
          }}
        >
          <div class="filename text_overflow_fade bg">
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
          class="saved_file_contextmenu"
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
            class="filename"
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
                  props.rightClickedFileNewName() === props.rightClickedFile()
                }
              >
                <button
                  class="button_icon"
                  onclick={(e) => {
                    e.stopPropagation();
                    onClickDownloadSavedFile(
                      props.activeDirectoryName(),
                      name.fullName,
                    );
                  }}
                >
                  <i class="bx bxs-download"></i>
                </button>
                <button
                  class={
                    "button_icon " +
                    (props.confirmAction() === ConfirmAction.TrashFile
                      ? "red"
                      : "")
                  }
                  onclick={(e) => {
                    e.stopPropagation();
                    trashSavedFile(
                      name.fullName,
                      props.activeDirectoryName(),
                      props.activeDirectoryParsedFileNames(),
                      props.confirmAction(),
                    ).then(async (result) => {
                      if (result) {
                        props.setActiveDirectoryParsedFileNames(result.dirFileNames);
                        props.setConfirmAction(result.confirmAction);
                        if (result.clearRightClick) {
                          props.setRightClickedFile(null);
                        }
                        if (result.directoryNeedsUpdate) {
                          props.setDirectoryNames(
                            await updateDirectories(
                              props.directoryNames(),
                              props.activeDirectoryName(),
                            ),
                          );
                        }
                      }
                    });
                  }}
                >
                  <i class="bx bxs-trash-alt"></i>
                </button>
              </Match>
              <Match
                when={
                  props.rightClickedFileNewName() !== null &&
                  props.rightClickedFileNewName() !== props.rightClickedFile()
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
                    renameSavedFile(
                      name.fullName,
                      props.rightClickedFileNewName()!,
                      props.activeDirectoryName(),
                      props.activeDirectoryParsedFileNames(),
                      props.viewedFile(),
                    ).then((result) => {
                      if (result) {
                        props.setActiveDirectoryParsedFileNames(result.dirFileNames);
                        props.setViewedFile(result.viewedFile);
                      }
                    });
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
