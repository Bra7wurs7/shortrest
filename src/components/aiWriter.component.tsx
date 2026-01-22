import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Match,
  Setter,
  Show,
  Switch,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { TextUnits } from "../types/textUnits.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { BasicFile } from "../types/basicFile.interface";
import { getFileContent } from "../functions/dbFilesInterface.functions";
import { parseFileReferences } from "../functions/llm/parseFileReferences.function";
import { PromptState } from "../types/promptState.interface";

export interface AiWriterProps {
  displayedReactiveFile: Accessor<ReactiveFile | null>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  promptState: PromptState;
  // Setters for derived data that App.tsx needs for LLM calls
  setReducedFileContent: Setter<string>;
  setReferencedFilesContents: Setter<BasicFile[]>;
  setReferencedTagFileContents: Setter<BasicFile[]>;
}

export function AiWriter(props: AiWriterProps): JSXElement {
  const ps = props.promptState;

  // ============================================
  // Memos for tag/file references
  // ============================================
  const allDefinedTags = createMemo<string[][]>(() => {
    const activeDirParsedFileNames = props.activeDirectoryParsedFileNames();

    if (activeDirParsedFileNames) {
      return (
        activeDirParsedFileNames
          .filter((fn) => !fn.baseName && fn.tags.length > 0)
          .map((fn) => fn.tags) ?? []
      );
    }
    return [];
  });

  const referencedFiles = createMemo<string[]>(() => {
    return parseFileReferences(
      ps.userPrompt(),
      props.activeDirectoryParsedFileNames(),
    );
  });

  const [referencedFilesContents, setReferencedFilesContents] = createSignal<
    BasicFile[]
  >([]);

  // Load referenced file contents when referencedFiles changes
  createEffect(() => {
    const fileNames = referencedFiles();
    const activeDirName = props.activeDirectoryName();

    if (activeDirName && fileNames.length > 0) {
      const fileContentPromises = fileNames.map(async (fileName: string) => {
        return {
          name: fileName,
          content: (await getFileContent(activeDirName, fileName)) ?? "",
        };
      });
      Promise.all(fileContentPromises).then((files) => {
        setReferencedFilesContents(files);
        props.setReferencedFilesContents(files);
      });
    } else {
      setReferencedFilesContents([]);
      props.setReferencedFilesContents([]);
    }
  });

  const referencedTags = createMemo<string[][]>(() => {
    const fileName = props.displayedReactiveFile()?.name();
    const prompt = ps.userPrompt();
    return allDefinedTags().filter(
      (tag) =>
        (fileName?.includes(`${tag.join(" ")}`) &&
          fileName !== `${tag.join(" ")}`) ||
        prompt.includes(`${tag.join(" ")}`),
    );
  });

  const [referencedTagFileContents, setReferencedTagFileContents] =
    createSignal<BasicFile[]>([]);

  // Load referenced tag file contents when referencedTags changes
  createEffect(() => {
    const appearingTags = referencedTags();
    const activeDirName = props.activeDirectoryName();
    if (activeDirName !== null && appearingTags.length > 0) {
      const fileContentPromises = appearingTags.map(async (tag: string[]) => {
        const fileName = tag.map((fn) => `${fn}`).join(" ");
        return {
          name: fileName,
          content: (await getFileContent(activeDirName, fileName)) ?? "",
        };
      });
      Promise.all(fileContentPromises).then((files) => {
        setReferencedTagFileContents(files);
        props.setReferencedTagFileContents(files);
      });
    } else {
      setReferencedTagFileContents([]);
      props.setReferencedTagFileContents([]);
    }
  });

  const reducedFileContent = createMemo(() => {
    const wholeFile = props.displayedReactiveFile()?.content() ?? "";
    let reducedFile = wholeFile;
    const length = ps.reducedFileContentLength();
    const unit = ps.reducedFileContentUnit();

    if (length === 0 || unit === TextUnits.All) {
      return wholeFile;
    }

    if (unit === TextUnits.Words) {
      const words = wholeFile.split(/\s+/);
      reducedFile = words.slice(-length).join(" ");
    } else if (unit === TextUnits.Sentences) {
      const sentences = wholeFile.split(/[.!?]\s+/);
      reducedFile = sentences.slice(-length).join(". ");
    } else if (unit === TextUnits.Paragraphs) {
      const paragraphs = wholeFile.split(/\n\n/);
      reducedFile = paragraphs.slice(-length).join("\n\n");
    } else if (unit === TextUnits.Segments) {
      const segments = wholeFile.split(/[.!?]\s+/);
      reducedFile = segments.slice(-length).join(". ");
    }

    return reducedFile;
  });

  // Notify parent of reducedFileContent changes
  createEffect(() => {
    props.setReducedFileContent(reducedFileContent());
  });

  // ============================================
  // UI Helpers
  // ============================================
  function onClickTagToggle(tuple: string[]) {
    const tag = `${tuple.join(" ")}`;
    const dsbldTags = ps.disabledTags();
    if (dsbldTags.includes(tag)) {
      ps.setDisabledTags(dsbldTags.filter((t) => t !== tag));
    } else {
      ps.setDisabledTags([tag, ...dsbldTags]);
    }
  }

  function onClickFileToggle(name: string) {
    const dsbldFiles = ps.disabledFiles();
    if (dsbldFiles.includes(name)) {
      ps.setDisabledFiles(dsbldFiles.filter((f) => f !== name));
    } else {
      ps.setDisabledFiles([name, ...dsbldFiles]);
    }
  }

  // ============================================
  // Render
  // ============================================
  return (
    <div id="AIWRITER_SIDEBAR">
      <div id="A_S_TOP">
        <Show when={referencedTags().length > 0}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bx-hash"></i>
              <span>Tags</span>
            </div>
            <div
              class="right"
              onclick={() => ps.setDisabledAllTags(!ps.disabledAllTags())}
            >
              <Switch>
                <Match when={ps.disabledAllTags()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ps.disabledAllTags()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="tags_list">
            <For each={referencedTags()}>
              {(tuple) => {
                return (
                  <div
                    class={
                      "tag_row " +
                      (ps.disabledTags().includes(`${tuple.join(" ")}`)
                        ? "disabled"
                        : "")
                    }
                    onclick={() => onClickTagToggle(tuple)}
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
                        when={ps.disabledTags().includes(`${tuple.join(" ")}`)}
                      >
                        <i class="bx bx-checkbox"></i>
                      </Match>
                      <Match
                        when={!ps.disabledTags().includes(`${tuple.join(" ")}`)}
                      >
                        <i class="bx bx-checkbox-checked"></i>
                      </Match>
                    </Switch>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
        <Show when={referencedFiles().length > 0}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bx-bracket"></i>
              <span>Referenzen</span>
            </div>
            <div
              class="right"
              onclick={() => ps.setDisabledAllFiles(!ps.disabledAllFiles())}
            >
              <Switch>
                <Match when={ps.disabledAllFiles()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ps.disabledAllFiles()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="tags_list">
            <For each={referencedFiles()}>
              {(name) => {
                return (
                  <div
                    class={
                      "tag_row " +
                      (ps.disabledFiles().includes(`${name}`) ? "disabled" : "")
                    }
                    onclick={() => onClickFileToggle(name)}
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
        </Show>
        <div class="prompt_header">
          <div class="left">
            <i class="bx bx-info-circle"></i>
            <span>System Prompt</span>
          </div>
          <div
            class="right"
            onclick={() =>
              ps.setDisabledSystemPrompt(!ps.disabledSystemPrompt())
            }
          >
            <Switch>
              <Match when={ps.disabledSystemPrompt()}>
                <i class="bx bx-square"></i>
              </Match>
              <Match when={!ps.disabledSystemPrompt()}>
                <i class="bx bx-check-square"></i>
              </Match>
            </Switch>
          </div>
        </div>
        <textarea
          class={"prompt" + (ps.disabledSystemPrompt() ? " disabled" : "")}
          rows={10}
          value={ps.systemPrompt()}
          onInput={(e) => {
            ps.setSystemPrompt(e.currentTarget.value);
          }}
        />
        <Show when={reducedFileContent()}>
          <div class="prompt_header">
            <div>
              <i class="bx bxs-file"></i>
              <span>File Context</span>
            </div>
            <div
              class="right"
              onclick={() =>
                ps.setDisabledFileContext(!ps.disabledFileContext())
              }
            >
              <Switch>
                <Match when={ps.disabledFileContext()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ps.disabledFileContext()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="prompt_settings">
            <input
              type="number"
              value={ps.reducedFileContentLength()}
              step={1}
              onInput={(e) => {
                ps.setReducedFileContentLength(Number(e.currentTarget.value));
              }}
            />
            <select
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
          </div>
          <div
            class={
              "readonly_prompt" + (ps.disabledFileContext() ? " disabled" : "")
            }
          >
            {reducedFileContent()}
          </div>
        </Show>
        <Show when={ps.modelThoughts()}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bx-network-chart"></i>
              <span>Thoughts</span>
            </div>
            <div
              class="right"
              onclick={() => ps.setDisabledThoughts(!ps.disabledThoughts())}
            >
              <Switch>
                <Match when={ps.disabledThoughts()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ps.disabledThoughts()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>

          <div class="prompt_settings">
            <button class="" onclick={() => ps.setModelThoughts("")}>
              Forget
            </button>
          </div>
          <div class={"prompt" + (ps.disabledThoughts() ? " disabled" : "")}>
            {ps.modelThoughts()}
          </div>
        </Show>
        <Show when={ps.userPrompt()}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bxs-user-voice"></i>
              <span>User Prompt</span>
            </div>
            <div
              class="right"
              onclick={() => ps.setDisabledUserPrompt(!ps.disabledUserPrompt())}
            >
              <Switch>
                <Match when={ps.disabledUserPrompt()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ps.disabledUserPrompt()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class={"prompt" + (ps.disabledUserPrompt() ? " disabled" : "")}>
            {ps.userPrompt()}
          </div>
        </Show>
      </div>
      <div>
        <Show when={ps.runningPrompt() !== null}>
          <button
            class="user_action yellow_border"
            onclick={() => {
              ps.runningPrompt()?.abort();
            }}
          >
            Abort
            <i class="bx bx-block yellow_dim" />
          </button>
        </Show>
      </div>
    </div>
  );
}
