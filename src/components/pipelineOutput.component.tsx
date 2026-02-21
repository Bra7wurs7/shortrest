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

/**
 * Replaces raw tool-call markup in LLM output with formatted HTML details blocks,
 * so the agentic exchange is readable but unobtrusive.
 *
 * Patterns handled:
 *   <tool>name</tool><arg>value</arg>   → collapsed <details> showing "🔧 name(value)"
 *   <tool_result tool="name">…</tool_result> → content inside that details block
 */
function formatToolMarkup(text: string): string {
  // Replace paired call + result: <tool>…</tool><arg>…</arg> … <tool_result tool="…">…</tool_result>
  // We handle them in two passes so partial output (mid-stream) degrades gracefully.

  // Pass 1: wrap complete tool calls that have a matching result on the same line/block
  let out = text.replace(
    /<tool>([\s\S]*?)<\/tool>(?:<arg>([\s\S]*?)<\/arg>)?[\s\S]*?<tool_result tool="[^"]*">([\s\S]*?)<\/tool_result>/g,
    (_match, name: string, arg: string | undefined, result: string) => {
      const label = arg ? `${name.trim()}(${arg.trim()})` : name.trim();
      const safeResult = result.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<details class="tool_call"><summary>🔧 ${label}</summary><pre>${safeResult}</pre></details>`;
    },
  );

  // Pass 2: any remaining bare <tool> calls without a result yet (streaming in-progress) — just show the call
  out = out.replace(
    /<tool>([\s\S]*?)<\/tool>(?:<arg>([\s\S]*?)<\/arg>)?/g,
    (_match, name: string, arg: string | undefined) => {
      const label = arg ? `${name.trim()}(${arg.trim()})` : name.trim();
      return `<details class="tool_call"><summary>🔧 ${label}…</summary></details>`;
    },
  );

  return out;
}

function renderMarkdown(text: string): string {
  if (!text) return "";
  try {
    return micromark(formatToolMarkup(text), {
      extensions: [gfm()],
      htmlExtensions: [gfmHtml()],
      allowDangerousHtml: true,
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
