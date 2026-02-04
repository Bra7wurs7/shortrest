import {
  Accessor,
  For,
  JSXElement,
  Match,
  Setter,
  Show,
  Switch,
} from "solid-js";
import { TextUnits } from "../types/textUnits.enum";
import { SummaryStyle } from "../types/summaryStyle.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { BasicFile } from "../types/basicFile.interface";
import { PromptState } from "../types/promptState.interface";
import { PromptSection } from "./promptSection.component";
import { useAiWriterState } from "../hooks/useAiWriterState";

export interface AiWriterProps {
  displayedFileContent: Accessor<string>;
  displayedFileName: Accessor<string | null>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  promptState: PromptState;
  // Setters for derived data that App.tsx needs for LLM calls
  setReducedFileContent: Setter<string>;
  setReferencedFilesContents: Setter<BasicFile[]>;
  setReferencedTagFileContents: Setter<BasicFile[]>;
  // Summary action handlers
  onGenerateSummary: (mode: "generate" | "extend") => void;
}

export function AiWriter(props: AiWriterProps): JSXElement {
  const ps = props.promptState;

  const state = useAiWriterState({
    displayedFileContent: props.displayedFileContent,
    displayedFileName: props.displayedFileName,
    activeDirectoryParsedFileNames: props.activeDirectoryParsedFileNames,
    activeDirectoryName: props.activeDirectoryName,
    promptState: ps,
    setReducedFileContent: props.setReducedFileContent,
    setReferencedFilesContents: props.setReferencedFilesContents,
    setReferencedTagFileContents: props.setReferencedTagFileContents,
  });

  return (
    <div id="AIWRITER_SIDEBAR">
      <div id="A_S_TOP">
        {/* Tags Section */}
        <Show when={state.referencedTags().length > 0}>
          <PromptSection
            id="A_S_TAGS"
            icon="bx-hash"
            label="Tags"
            disabled={ps.disabledAllTags}
            onToggleDisabled={() =>
              ps.setDisabledAllTags(!ps.disabledAllTags())
            }
            collapsed={state.sectionCollapsed.tags}
            onToggleCollapsed={() => state.toggleSectionCollapsed("tags")}
          >
            <div id="A_S_TAGS_LIST" class="tags_list">
              <For each={state.referencedTags()}>
                {(tuple) => {
                  return (
                    <div
                      class={
                        "tag_row " +
                        (ps.disabledTags().includes(`${tuple.join(" ")}`)
                          ? "disabled"
                          : "")
                      }
                      onclick={() => state.onClickTagToggle(tuple)}
                    >
                      <div>
                        <For each={tuple}>
                          {(tag) => {
                            return <div>{tag}</div>;
                          }}
                        </For>
                      </div>
                      <Switch>
                        <Match
                          when={ps
                            .disabledTags()
                            .includes(`${tuple.join(" ")}`)}
                        >
                          <i class="bx bx-checkbox"></i>
                        </Match>
                        <Match
                          when={
                            !ps.disabledTags().includes(`${tuple.join(" ")}`)
                          }
                        >
                          <i class="bx bx-checkbox-checked"></i>
                        </Match>
                      </Switch>
                    </div>
                  );
                }}
              </For>
            </div>
          </PromptSection>
        </Show>

        {/* File References Section */}
        <Show when={state.referencedFiles().length > 0}>
          <PromptSection
            id="A_S_REFERENCES"
            icon="bx-bracket"
            label="Referenzen"
            disabled={ps.disabledAllFiles}
            onToggleDisabled={() =>
              ps.setDisabledAllFiles(!ps.disabledAllFiles())
            }
            collapsed={state.sectionCollapsed.references}
            onToggleCollapsed={() => state.toggleSectionCollapsed("references")}
          >
            <div id="A_S_REFERENCES_LIST" class="tags_list">
              <For each={state.referencedFiles()}>
                {(name) => {
                  return (
                    <div
                      class={
                        "tag_row " +
                        (ps.disabledFiles().includes(`${name}`)
                          ? "disabled"
                          : "")
                      }
                      onclick={() => state.onClickFileToggle(name)}
                    >
                      <div>{name}</div>
                      <Switch>
                        <Match when={ps.disabledFiles().includes(`${name}`)}>
                          <i class="bx bx-checkbox"></i>
                        </Match>
                        <Match when={!ps.disabledFiles().includes(`${name}`)}>
                          <i class="bx bx-checkbox-checked"></i>
                        </Match>
                      </Switch>
                    </div>
                  );
                }}
              </For>
            </div>
          </PromptSection>
        </Show>

        {/* System Prompt Section */}
        <PromptSection
          id="A_S_SYSTEM_PROMPT"
          icon="bx-info-circle"
          label="System Prompt"
          disabled={ps.disabledSystemPrompt}
          onToggleDisabled={() =>
            ps.setDisabledSystemPrompt(!ps.disabledSystemPrompt())
          }
          collapsed={state.sectionCollapsed.systemPrompt}
          onToggleCollapsed={() => state.toggleSectionCollapsed("systemPrompt")}
        >
          <textarea
            id="A_S_SYSTEM_PROMPT_INPUT"
            class={"prompt" + (ps.disabledSystemPrompt() ? " disabled" : "")}
            rows={10}
            value={ps.systemPrompt()}
            onInput={(e) => {
              ps.setSystemPrompt(e.currentTarget.value);
            }}
          />
        </PromptSection>

        {/* Rolling Summary Section */}
        <PromptSection
          id="A_S_ROLLING_SUMMARY"
          icon="bx-history"
          label="Rolling Summary"
          disabled={ps.disabledRollingSummary}
          onToggleDisabled={() =>
            ps.setDisabledRollingSummary(!ps.disabledRollingSummary())
          }
          collapsed={state.sectionCollapsed.rollingSummary}
          onToggleCollapsed={() =>
            state.toggleSectionCollapsed("rollingSummary")
          }
          settingsSlot={
            <>
              <div class="settings_row">
                <input
                  id="A_S_SUMMARY_MAX_LENGTH"
                  type="number"
                  value={ps.summaryMaxLength()}
                  step={50}
                  min={0}
                  onInput={(e) => {
                    ps.setSummaryMaxLength(Number(e.currentTarget.value));
                  }}
                  title="Maximum length for the generated summary"
                />
                <select
                  id="A_S_SUMMARY_MAX_LENGTH_UNIT"
                  value={ps.summaryMaxLengthUnit()}
                  onChange={(e) => {
                    ps.setSummaryMaxLengthUnit(
                      e.currentTarget.value as TextUnits,
                    );
                  }}
                  title="Unit for the maximum summary length (words, sentences, or paragraphs)"
                >
                  <option value={TextUnits.Words}>Words</option>
                  <option value={TextUnits.Sentences}>Sentences</option>
                  <option value={TextUnits.Paragraphs}>Paragraphs</option>
                </select>
                <select
                  id="A_S_SUMMARY_STYLE"
                  value={ps.summaryStyle()}
                  onChange={(e) => {
                    ps.setSummaryStyle(e.currentTarget.value as SummaryStyle);
                  }}
                  title="Writing style for the summary: Narrative (prose), Bullets (list), Key Events (chronological), or Characters (focus on people)"
                >
                  <option value={SummaryStyle.Narrative}>Narrative</option>
                  <option value={SummaryStyle.Bullets}>Bullets</option>
                  <option value={SummaryStyle.KeyEvents}>Key Events</option>
                  <option value={SummaryStyle.CharacterFocused}>
                    Characters
                  </option>
                </select>
              </div>
              <div class="settings_row">
                <button
                  onclick={() => props.onGenerateSummary("generate")}
                  title="Generate a new summary from the current file context, replacing any existing summary"
                  disabled={ps.runningPrompt() !== null}
                >
                  <i class="bx bx-refresh" />
                </button>
                <button
                  onclick={() => props.onGenerateSummary("extend")}
                  title="Extend the existing summary with new content from the file context"
                  disabled={
                    ps.runningPrompt() !== null ||
                    ps.rollingSummary().trim().length === 0
                  }
                >
                  <i class="bx bx-plus" />
                </button>
                <button
                  onclick={() => ps.setRollingSummary("")}
                  title="Clear the summary"
                  disabled={ps.rollingSummary().trim().length === 0}
                >
                  <i class="bx bx-trash" />
                </button>
                <button
                  class={ps.autoSummarize() ? "active" : ""}
                  onclick={() => ps.setAutoSummarize(!ps.autoSummarize())}
                  title="Automatically generate or extend the summary after the AI finishes writing"
                >
                  <i class="bx bx-bot" />
                </button>
              </div>
            </>
          }
        >
          <textarea
            id="A_S_ROLLING_SUMMARY_INPUT"
            class={"prompt" + (ps.disabledRollingSummary() ? " disabled" : "")}
            rows={6}
            value={ps.rollingSummary()}
            onInput={(e) => {
              ps.setRollingSummary(e.currentTarget.value);
            }}
            placeholder="Summary of previous content..."
          />
        </PromptSection>

        {/* File Context Section */}
        <Show when={state.reducedFileContent()}>
          <PromptSection
            id="A_S_FILE_CONTEXT"
            icon="bxs-file"
            label="File Context"
            disabled={ps.disabledFileContext}
            onToggleDisabled={() =>
              ps.setDisabledFileContext(!ps.disabledFileContext())
            }
            collapsed={state.sectionCollapsed.fileContext}
            onToggleCollapsed={() =>
              state.toggleSectionCollapsed("fileContext")
            }
            settingsSlot={
              <>
                <input
                  id="A_S_FILE_CONTEXT_LENGTH"
                  type="number"
                  value={ps.reducedFileContentLength()}
                  step={1}
                  onInput={(e) => {
                    ps.setReducedFileContentLength(
                      Number(e.currentTarget.value),
                    );
                  }}
                />
                <select
                  id="A_S_FILE_CONTEXT_UNIT"
                  value={ps.reducedFileContentUnit()}
                  onChange={(e) => {
                    ps.setReducedFileContentUnit(
                      e.currentTarget.value as TextUnits,
                    );
                  }}
                >
                  <option value={TextUnits.Words}>Words</option>
                  <option value={TextUnits.Sentences}>Sentences</option>
                  <option value={TextUnits.Paragraphs}>Paragraphs</option>
                  <option value={TextUnits.All}>All</option>
                </select>
              </>
            }
          >
            <div
              id="A_S_FILE_CONTEXT_CONTENT"
              class={
                "readonly_prompt" +
                (ps.disabledFileContext() ? " disabled" : "")
              }
            >
              {state.reducedFileContent()}
            </div>
          </PromptSection>
        </Show>

        {/* Thoughts Section */}
        <Show when={ps.modelThoughts()}>
          <PromptSection
            id="A_S_THOUGHTS"
            icon="bx-network-chart"
            label="Thoughts"
            disabled={ps.disabledThoughts}
            onToggleDisabled={() =>
              ps.setDisabledThoughts(!ps.disabledThoughts())
            }
            collapsed={state.sectionCollapsed.thoughts}
            onToggleCollapsed={() => state.toggleSectionCollapsed("thoughts")}
            settingsSlot={
              <button onclick={() => ps.setModelThoughts("")}>Forget</button>
            }
          >
            <div
              id="A_S_THOUGHTS_CONTENT"
              class={"prompt" + (ps.disabledThoughts() ? " disabled" : "")}
            >
              {ps.modelThoughts()}
            </div>
          </PromptSection>
        </Show>

        {/* User Prompt Section */}
        <Show when={ps.userPrompt()}>
          <PromptSection
            id="A_S_USER_PROMPT"
            icon="bxs-user-voice"
            label="User Prompt"
            disabled={ps.disabledUserPrompt}
            onToggleDisabled={() =>
              ps.setDisabledUserPrompt(!ps.disabledUserPrompt())
            }
            collapsed={state.sectionCollapsed.userPrompt}
            onToggleCollapsed={() => state.toggleSectionCollapsed("userPrompt")}
          >
            <div
              id="A_S_USER_PROMPT_CONTENT"
              class={"prompt" + (ps.disabledUserPrompt() ? " disabled" : "")}
            >
              {ps.userPrompt()}
            </div>
          </PromptSection>
        </Show>
      </div>

      {/* Bottom Section */}
      <div id="A_S_BOTTOM" />
    </div>
  );
}
