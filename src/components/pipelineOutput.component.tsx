import { Accessor, createMemo, For, JSXElement, Show } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { MessageNodeConfig } from "../types/messageNode.interface";
import { PipelineInstance } from "../hooks/usePipelineState";

export interface PipelineOutputProps {
  modelThoughts: Accessor<string>;
  modelOutput: Accessor<string>;
  /** Nodes of the active pipeline — used to find referenced sub-pipelines */
  messageNodes: Accessor<MessageNodeConfig[]>;
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

  /** Sub-pipelines referenced by active pipeline nodes, in node order, deduplicated */
  const referencedSubPipelines = createMemo<
    { pipeline: PipelineInstance; index: number }[]
  >(() => {
    const seen = new Set<string>();
    const result: { pipeline: PipelineInstance; index: number }[] = [];
    for (const node of props.messageNodes()) {
      if (node.acquisitionMode !== "sub-pipeline" || node.disabled) continue;
      if (seen.has(node.sourcePipelineId)) continue;
      seen.add(node.sourcePipelineId);
      const index = props.pipelines().findIndex((p) => p.id === node.sourcePipelineId);
      if (index === -1) continue;
      const pipeline = props.pipelines()[index];
      result.push({ pipeline, index });
    }
    return result;
  });

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
      <For each={referencedSubPipelines()}>
        {({ pipeline, index }) => (
          <Show when={pipeline.modelOutput() || pipeline.subPipelineRunning()}>
            <div class="pipeline_section_label sub_pipeline_output_label">
              <i class="bx bx-git-branch" />
              <Show when={pipeline.subPipelineRunning()}>
                <i class="bx bx-loader-alt bx-spin" />
                <button
                  class="sub_pipeline_abort_btn"
                  onclick={() => props.onAbortSubPipeline(pipeline.id)}
                  title="Abort sub-pipeline"
                >
                  <i class="bx bx-stop" />
                </button>
              </Show>
              pipeline {index + 1}
            </div>
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
        )}
      </For>
    </div>
  );
}
