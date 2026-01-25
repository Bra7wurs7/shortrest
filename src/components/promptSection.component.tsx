import { Accessor, JSXElement, Match, Show, Switch } from "solid-js";

export interface PromptSectionProps {
  /** Unique ID for the section container */
  id: string;
  /** Boxicon class name (e.g., "bx-hash", "bxs-file") */
  icon: string;
  /** Section label text */
  label: string;
  /** Whether the section content is disabled */
  disabled: Accessor<boolean>;
  /** Callback when the disable toggle is clicked */
  onToggleDisabled: () => void;
  /** Whether the section is collapsed (optional - if not provided, section is always expanded) */
  collapsed?: Accessor<boolean>;
  /** Callback when the collapse toggle is clicked */
  onToggleCollapsed?: () => void;
  /** Optional settings row content (rendered between header and main content) */
  settingsSlot?: JSXElement;
  /** Main content of the section */
  children: JSXElement;
}

/**
 * Reusable component for prompt sections in the AiWriter sidebar.
 * Provides consistent header with collapse/expand and enable/disable toggles.
 * The wrapper div receives the ID and handles margin spacing.
 */
export function PromptSection(props: PromptSectionProps): JSXElement {
  const isCollapsible = () =>
    props.collapsed !== undefined && props.onToggleCollapsed !== undefined;
  const isCollapsed = () => props.collapsed?.() ?? false;

  return (
    <div
      id={props.id}
      class={"ai_section" + (isCollapsed() ? " collapsed" : "")}
    >
      <div
        class="prompt_header"
        onclick={() => {
          if (isCollapsible()) {
            props.onToggleCollapsed?.();
          }
        }}
      >
        <div class="left">
          <Show when={isCollapsible()}>
            <i
              class={
                "bx " + (isCollapsed() ? "bx-chevron-right" : "bx-chevron-down")
              }
            ></i>
          </Show>
          <i class={"bx " + props.icon}></i>
          <span>{props.label}</span>
        </div>
        <div
          class="right"
          onclick={(e) => {
            e.stopPropagation();
            props.onToggleDisabled();
          }}
        >
          <Switch>
            <Match when={props.disabled()}>
              <i class="bx bx-square"></i>
            </Match>
            <Match when={!props.disabled()}>
              <i class="bx bx-check-square"></i>
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={!isCollapsed()}>
        <Show when={props.settingsSlot}>
          <div class="prompt_settings">{props.settingsSlot}</div>
        </Show>
        <div class="prompt_body">{props.children}</div>
      </Show>
    </div>
  );
}
