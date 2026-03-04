import "./leftToolbar.component.css";
import {
  Accessor,
  For,
  JSXElement,
  Match,
  Setter,
  Show,
  Switch,
} from "solid-js";
import {
  onClickUploadDirectory,
  onClickDownloadDirectory,
  onClickDeleteDirectory,
} from "../app-handlers";
import { localStorageActiveDirectoryName } from "../constants/storageKeys";

export interface LeftToolbarProps {
  directoryNames: Accessor<string[]>;
  setDirectoryNames: Setter<string[]>;
  activeDirectoryName: Accessor<string | null>;
  setActiveDirectoryName: Setter<string | null>;
  rightClickedDirectory: Accessor<string | null>;
  setRightClickedDirectory: Setter<string | null>;
  rightClickedDirectoryDelete: Accessor<boolean>;
  setRightClickedDirectoryDelete: Setter<boolean>;
  hoveredDirectoryName: Accessor<string | null>;
  setHoveredDirectoryName: Setter<string | null>;
}

export function LeftToolbar(props: LeftToolbarProps): JSXElement {
  function resetRightClick() {
    props.setRightClickedDirectory("");
    props.setRightClickedDirectoryDelete(false);
  }

  return (
    <div id="LEFT_TOOLBAR">
      <div id="LM_S_ACTIONS"></div>
      <div id="LM_S_BOTTOM">
        <button
          class="button_icon"
          onclick={(e) => {
            e.stopPropagation();
            onClickUploadDirectory(
              props.directoryNames,
              props.setDirectoryNames,
              props.activeDirectoryName,
            );
          }}
        >
          <i class="bx bx-upload"></i>
        </button>
        <div id="LM_S_DIRECTORIES">
          <For each={props.directoryNames()}>
            {(name: string, index: Accessor<number>) => (
              <Switch>
                <Match when={props.rightClickedDirectory() !== name}>
                  <button
                    class={
                      "button_icon " +
                      (name === props.activeDirectoryName() ? "active" : "")
                    }
                    onclick={() => {
                      props.setActiveDirectoryName(name);
                      localStorage.setItem(
                        localStorageActiveDirectoryName,
                        name,
                      );
                    }}
                    oncontextmenu={(e: PointerEvent) => {
                      e.preventDefault();
                      props.setRightClickedDirectory(name);
                      props.setRightClickedDirectoryDelete(false);
                    }}
                    onmouseenter={() => {
                      props.setHoveredDirectoryName(name);
                    }}
                    onmouseleave={() => {
                      props.setHoveredDirectoryName(null);
                    }}
                  >
                    <Show
                      when={
                        name === props.activeDirectoryName() && index() === 0
                      }
                    >
                      <i class="bx bx-folder-open"></i>
                    </Show>
                    <Show
                      when={name === props.activeDirectoryName() && index() > 0}
                    >
                      <i class="bx bxs-folder-open"></i>
                    </Show>
                    <Show
                      when={
                        !(name === props.activeDirectoryName()) && index() > 0
                      }
                    >
                      <i class="bx bxs-folder"></i>
                    </Show>
                    <Show
                      when={
                        !(name === props.activeDirectoryName()) && index() === 0
                      }
                    >
                      <i class="bx bx-folder-plus"></i>
                    </Show>
                  </button>
                </Match>
                <Match
                  when={
                    props.rightClickedDirectory() === name &&
                    !props.rightClickedDirectoryDelete()
                  }
                >
                  <button
                    class={
                      "button_icon " +
                      (name === props.activeDirectoryName() ? "active" : "")
                    }
                    onclick={() => {
                      onClickDownloadDirectory(name);
                      resetRightClick();
                    }}
                    oncontextmenu={(e: PointerEvent) => {
                      e.preventDefault();
                      props.setRightClickedDirectoryDelete(true);
                    }}
                    onmouseleave={resetRightClick}
                  >
                    <i class="bx bxs-download"></i>
                  </button>
                </Match>
                <Match
                  when={
                    props.rightClickedDirectory() === name &&
                    props.rightClickedDirectoryDelete()
                  }
                >
                  <button
                    class={
                      "button_icon red " +
                      (name === props.activeDirectoryName() ? "active" : "")
                    }
                    onclick={() => {
                      onClickDeleteDirectory(
                        name,
                        props.directoryNames,
                        props.setDirectoryNames,
                        props.activeDirectoryName,
                        props.setActiveDirectoryName,
                      );
                      resetRightClick();
                    }}
                    onmouseleave={resetRightClick}
                    title="Click to delete directory"
                  >
                    <i class="bx bx-x" />
                  </button>
                </Match>
              </Switch>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
