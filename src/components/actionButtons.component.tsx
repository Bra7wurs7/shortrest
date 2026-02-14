import { Accessor, JSXElement, Match, Switch } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";

export interface ActionButtonsProps {
  promptLoading: Accessor<boolean>;
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>;
  onPromptSubmit: () => void;
  onThinkSubmit: () => void;
}

export function ActionButtons(props: ActionButtonsProps): JSXElement {
  return (
    <div id="RIGHT_SIDE_BUTTONS">
      <Switch
        fallback={
          <button
            class="user_action"
            title="Read from and write to the active file"
            onClick={props.onPromptSubmit}
          >
            Continue Text
            <i class="bx bx-play-circle" />
          </button>
        }
      >
        <Match when={props.promptLoading()}>
          <button class="user_action" disabled>
            Loading
            <i class="bx bx-loader-alt bx-spin" />
          </button>
        </Match>
        <Match when={props.runningPrompt() !== null}>
          <button
            class="user_action yellow_border"
            onClick={() => props.runningPrompt()?.abort()}
          >
            Abort
            <i class="bx bx-block yellow_dim" />
          </button>
        </Match>
      </Switch>
      <button
        class="user_action fixed_width_icon"
        title="Have the LLM think about the active file"
        disabled={props.promptLoading() || props.runningPrompt() !== null}
        onClick={props.onThinkSubmit}
      >
        <i class="bx bx-network-chart" />
      </button>
    </div>
  );
}
