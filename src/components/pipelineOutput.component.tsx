import { Accessor, createMemo, JSXElement, Show } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export interface PipelineOutputProps {
  modelThoughts: Accessor<string>;
  modelOutput: Accessor<string>;
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  try {
    return micromark(text, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
    });
  } catch {
    return `<pre>${text}</pre>`;
  }
}

export function PipelineOutput(props: PipelineOutputProps): JSXElement {
  const renderedThoughts = createMemo(() =>
    renderMarkdown(props.modelThoughts()),
  );
  const renderedOutput = createMemo(() => renderMarkdown(props.modelOutput()));

  return (
    <div id="PIPELINE_OUTPUT">
      <Show when={props.modelThoughts()}>
        <div class="pipeline_section_label thoughts_label">
          <i class="bx bx-brain" />
          thoughts
        </div>
        <div class="pipeline_thoughts" innerHTML={renderedThoughts()} />
      </Show>
      <Show when={props.modelOutput()}>
        <div class="pipeline_section_label output_label">
          <i class="bx bx-comment-detail" />
          output
        </div>
        <div class="pipeline_markdown" innerHTML={renderedOutput()} />
      </Show>
    </div>
  );
}
