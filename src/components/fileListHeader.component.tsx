import { Accessor, JSXElement } from "solid-js";

export interface FileListHeaderProps {
  icon: string;
  label: string;
  collapsed: Accessor<boolean>;
  onToggleCollapsed: () => void;
}

export function FileListHeader(props: FileListHeaderProps): JSXElement {
  return (
    <div
      class="filelist_header"
      onclick={() => props.onToggleCollapsed()}
    >
      <div class="left">
        <i
          class={
            "bx " +
            (props.collapsed()
              ? "bx-chevron-right"
              : "bx-chevron-down")
          }
        ></i>
        <i class={"bx " + props.icon}></i>
        <span>{props.label}</span>
      </div>
      <div class="right"></div>
    </div>
  );
}
