import "./pipelineOutput.component.css";
import { Accessor, createEffect, createMemo, createSignal, For, JSXElement, Show } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { PipelineInstance } from "../hooks/usePipelineState";

export interface PipelineOutputProps {
  /** Active pipeline instance */
  pipeline: Accessor<PipelineInstance>;
  /** All pipeline instances */
  pipelines: Accessor<PipelineInstance[]>;
  /** Abort a running sub-pipeline by pipeline id */
  onAbortSubPipeline: (pipelineId: string) => void;
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  try {
    return micromark(text, {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
      allowDangerousHtml: true,
    });
  } catch {
    return `<pre>${text}</pre>`;
  }
}

export function PipelineOutput(props: PipelineOutputProps): JSXElement {
  const p = props.pipeline;
  const renderedThoughts = createMemo(() =>
    renderMarkdown(p().modelThoughts()),
  );
  const renderedOutput = createMemo(() => renderMarkdown(p().modelOutput()));

  const [thoughtsCollapsed, setThoughtsCollapsed] = createSignal(false);
  const [outputCollapsed, setOutputCollapsed] = createSignal(false);

  // Auto-collapse thoughts and sub-pipeline outputs once main output appears
  createEffect(() => {
    if (p().modelOutput()) {
      setThoughtsCollapsed(true);
    }
  });

  /** Sub-pipelines referenced by active pipeline nodes, in node order, deduplicated */
  const referencedSubPipelines = createMemo<
    { pipeline: PipelineInstance; index: number }[]
  >(() => {
    const seen = new Set<string>();
    const result: { pipeline: PipelineInstance; index: number }[] = [];
    for (const node of p().messageNodes()) {
      if (node.acquisitionMode !== "sub-pipeline" || node.disabled) continue;
      if (seen.has(node.sourcePipelineId)) continue;
      seen.add(node.sourcePipelineId);
      const index = props
        .pipelines()
        .findIndex((q) => q.id === node.sourcePipelineId);
      if (index === -1) continue;
      const pipeline = props.pipelines()[index];
      result.push({ pipeline, index });
    }
    return result;
  });

  return (
    <div id="PIPELINE_OUTPUT">
      <Show when={p().modelThoughts()}>
        <div
          class="pipeline_section_label thoughts_label collapsible"
          onclick={() => setThoughtsCollapsed(!thoughtsCollapsed())}
        >
          <i class={`bx bx-chevron-${thoughtsCollapsed() ? "right" : "down"}`} />
          <i class="bx bx-brain" />
          thoughts
        </div>
        <Show when={!thoughtsCollapsed()}>
          <div class="pipeline_thoughts" innerHTML={renderedThoughts()} />
        </Show>
      </Show>
      <Show when={p().modelOutput()}>
        <div
          class="pipeline_section_label output_label collapsible"
          onclick={() => setOutputCollapsed(!outputCollapsed())}
        >
          <i class={`bx bx-chevron-${outputCollapsed() ? "right" : "down"}`} />
          <i class="bx bx-comment-detail" />
          output
        </div>
        <Show when={!outputCollapsed()}>
          <div class="pipeline_markdown" innerHTML={renderedOutput()} />
        </Show>
      </Show>
      <For each={referencedSubPipelines()}>
        {({ pipeline, index }) => {
          const [subCollapsed, setSubCollapsed] = createSignal(false);

          // Auto-collapse sub-pipeline output once main output appears
          createEffect(() => {
            if (p().modelOutput()) {
              setSubCollapsed(true);
            }
          });

          return (
            <Show when={pipeline.modelOutput() || pipeline.subPipelineRunning()}>
              <div
                class="pipeline_section_label sub_pipeline_output_label collapsible"
                onclick={() => setSubCollapsed(!subCollapsed())}
              >
                <i class={`bx bx-chevron-${subCollapsed() ? "right" : "down"}`} />
                <i class="bx bx-git-branch" />
                <Show when={pipeline.subPipelineRunning()}>
                  <i class="bx bx-loader-alt bx-spin" />
                  <button
                    class="sub_pipeline_abort_btn"
                    onclick={(e) => { e.stopPropagation(); props.onAbortSubPipeline(pipeline.id); }}
                    title="Abort sub-pipeline"
                  >
                    <i class="bx bx-stop" />
                  </button>
                </Show>
                pipeline {index + 1}
              </div>
              <Show when={!subCollapsed()}>
                <Show
                  when={pipeline.modelOutput()}
                  fallback={<div class="pipeline_sub_placeholder" />}
                >
                  <div
                    class="pipeline_markdown pipeline_sub_output"
                    innerHTML={renderMarkdown(pipeline.modelOutput())}
                  />
                </Show>
              </Show>
            </Show>
          );
        }}
      </For>
    </div>
  );
}
