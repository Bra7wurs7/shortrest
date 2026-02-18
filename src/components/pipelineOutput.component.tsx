import { Accessor, createMemo, JSXElement, Show } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export interface PipelineOutputProps {
  modelThoughts: Accessor<string>;
  modelOutput: Accessor<string>;
  thoughtsCollapsed: Accessor<boolean>;
  setThoughtsCollapsed: (v: boolean) => void;
}

export function PipelineOutput(props: PipelineOutputProps): JSXElement {
  const renderedMarkdown = createMemo(() => {
    const output = props.modelOutput();
    if (!output) return "";
    try {
      return micromark(output, {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      });
    } catch {
      return `<pre>${output}</pre>`;
    }
  });

  return (
    <div id="PIPELINE_OUTPUT">
      <Show when={props.modelThoughts()}>
        <div class="pipeline_output_section">
          <div
            class="prompt_header"
            onclick={() =>
              props.setThoughtsCollapsed(!props.thoughtsCollapsed())
            }
          >
            <div class="left">
              <i
                class={
                  "bx " +
                  (props.thoughtsCollapsed()
                    ? "bx-chevron-right"
                    : "bx-chevron-down")
                }
              />
              <i class="bx bx-network-chart" />
              <span>Thoughts</span>
            </div>
          </div>
          <Show when={!props.thoughtsCollapsed()}>
            <div class="pipeline_thoughts">{props.modelThoughts()}</div>
          </Show>
        </div>
      </Show>
      <Show when={props.modelOutput()}>
        <div class="pipeline_output_section">
          <div class="pipeline_markdown" innerHTML={renderedMarkdown()} />
        </div>
      </Show>
    </div>
  );
}
