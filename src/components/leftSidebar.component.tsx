import "./leftSidebar.component.css";
import { Accessor, For, JSXElement, Setter, Show } from "solid-js";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { ViewedFile } from "../types/viewedFile.interface";
import { ClipboardEntry } from "../types/clipboardEntry.interface";
import { ConfirmAction } from "../types/confirmAction.enum";
import { FileListHeader } from "./fileListHeader.component";
import { ClipboardFileEntry } from "./clipboardFileEntry.component";
import { DirectoryFileEntry } from "./directoryFileEntry.component";

export interface LeftSidebarProps {
  // Clipboard section
  clipboardCollapsed: Accessor<boolean>;
  setClipboardCollapsed: Setter<boolean>;
  filteredParsedClipboardFileNames: Accessor<ParsedFileName[]>;
  clipboard: Accessor<ClipboardEntry[]>;
  setClipboard: Setter<ClipboardEntry[]>;
  viewedFile: Accessor<ViewedFile | null>;
  setViewedFile: Setter<ViewedFile | null>;
  rightClickedClipboardFile: Accessor<string | null>;
  setRightClickedClipboardFile: Setter<string | null>;
  rightClickedClipboardFileNewName: Accessor<string | null>;
  setRightClickedClipboardFileNewName: Setter<string | null>;
  confirmAction: Accessor<ConfirmAction | null>;
  setConfirmAction: Setter<ConfirmAction | null>;
  directoryNames: Accessor<string[]>;
  setDirectoryNames: Setter<string[]>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  setActiveDirectoryParsedFileNames: Setter<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  setIdbFileContent: Setter<string>;

  // Directory section
  directoryCollapsed: Accessor<boolean>;
  setDirectoryCollapsed: Setter<boolean>;
  hoveredDirectoryFileNames: Accessor<ParsedFileName[] | null>;
  hoveredDirectoryName: Accessor<string | null>;
  filteredParsedDirectoryFileNames: Accessor<ParsedFileName[] | null>;
  rightClickedSavedFile: Accessor<string | null>;
  setRightClickedSavedFile: Setter<string | null>;
  rightClickedSavedFileNewName: Accessor<string | null>;
  setRightClickedSavedFileNewName: Setter<string | null>;
}

export function LeftSidebar(props: LeftSidebarProps): JSXElement {
  return (
    <div
      id="LEFT_SIDEBAR"
      class={
        props.hoveredDirectoryFileNames() !== null &&
        props.hoveredDirectoryName() !== props.activeDirectoryName()
          ? "showing_hovered_directory"
          : ""
      }
    >
      <div
        id="L_S_TOP"
        class={props.clipboardCollapsed() ? "collapsed" : ""}
      >
        <FileListHeader
          icon="bx-clipboard"
          label="Clipboard"
          collapsed={props.clipboardCollapsed}
          onToggleCollapsed={() =>
            props.setClipboardCollapsed(!props.clipboardCollapsed())
          }
        />
        <Show when={!props.clipboardCollapsed()}>
          <div id="L_S_CLIPBOARD">
            <For each={props.filteredParsedClipboardFileNames()}>
              {(parsedName: ParsedFileName) => (
                <ClipboardFileEntry
                  parsedName={parsedName}
                  viewedFile={props.viewedFile}
                  clipboard={props.clipboard}
                  setClipboard={props.setClipboard}
                  setViewedFile={props.setViewedFile}
                  rightClickedFile={props.rightClickedClipboardFile}
                  setRightClickedFile={props.setRightClickedClipboardFile}
                  rightClickedFileNewName={props.rightClickedClipboardFileNewName}
                  setRightClickedFileNewName={props.setRightClickedClipboardFileNewName}
                  confirmAction={props.confirmAction}
                  setConfirmAction={props.setConfirmAction}
                  activeDirectoryParsedFileNames={props.activeDirectoryParsedFileNames}
                  setActiveDirectoryParsedFileNames={props.setActiveDirectoryParsedFileNames}
                  activeDirectoryName={props.activeDirectoryName}
                  setIdbFileContent={props.setIdbFileContent}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
      <div
        id="L_S_BOTTOM"
        class={props.directoryCollapsed() ? "collapsed" : ""}
      >
        <FileListHeader
          icon="bx-folder-open"
          label="Directory"
          collapsed={props.directoryCollapsed}
          onToggleCollapsed={() =>
            props.setDirectoryCollapsed(!props.directoryCollapsed())
          }
        />
        <Show when={!props.directoryCollapsed()}>
          <Show
            when={
              props.hoveredDirectoryFileNames() ||
              props.filteredParsedDirectoryFileNames() !== null
            }
          >
            <div id="L_S_DIRECTORY">
              <For
                each={
                  props.hoveredDirectoryFileNames()
                    ? props.hoveredDirectoryFileNames()
                    : props.filteredParsedDirectoryFileNames()
                }
              >
                {(parsedName: ParsedFileName) => (
                  <DirectoryFileEntry
                    parsedName={parsedName}
                    viewedFile={props.viewedFile}
                    clipboard={props.clipboard}
                    setViewedFile={props.setViewedFile}
                    rightClickedFile={props.rightClickedSavedFile}
                    setRightClickedFile={props.setRightClickedSavedFile}
                    rightClickedFileNewName={props.rightClickedSavedFileNewName}
                    setRightClickedFileNewName={props.setRightClickedSavedFileNewName}
                    confirmAction={props.confirmAction}
                    setConfirmAction={props.setConfirmAction}
                    activeDirectoryName={props.activeDirectoryName}
                    activeDirectoryParsedFileNames={props.activeDirectoryParsedFileNames}
                    setActiveDirectoryParsedFileNames={props.setActiveDirectoryParsedFileNames}
                    directoryNames={props.directoryNames}
                    setDirectoryNames={props.setDirectoryNames}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
