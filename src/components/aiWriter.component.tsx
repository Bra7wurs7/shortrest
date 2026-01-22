import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Match,
  Show,
  Switch,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { TextUnits } from "../types/textUnits.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { BasicFile } from "../types/basicFile.interface";
import { getFileContent } from "../functions/dbFilesInterface.functions";
import {
  usePromptContext,
  localStorageChatSystemPrompt,
  localStorageChatAssistentPromptLength,
  localStorageChatAssistentPromptUnit,
  sessionStorageDisabledTags,
  sessionStorageDisabledFiles,
} from "../contexts/promptContext";
import { parseFileReferences } from "../functions/llm/parseFileReferences.function";

export interface AiWriterProps {
  displayedReactiveFile: Accessor<ReactiveFile | null>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  // Callbacks for derived data that App.tsx needs
  onReducedFileContentChange?: (content: Accessor<string>) => void;
  onReferencedFilesContentsChange?: (contents: Accessor<BasicFile[]>) => void;
  onReferencedTagFileContentsChange?: (contents: Accessor<BasicFile[]>) => void;
}

export function AiWriter(props: AiWriterProps): JSXElement {
  const ctx = usePromptContext();

  // Memos for determining which tags/files are referenced
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
      ctx.userPrompt(),
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
      });
    } else {
      setReferencedFilesContents([]);
    }
  });

  // Notify parent of referencedFilesContents changes
  createEffect(() => {
    props.onReferencedFilesContentsChange?.(referencedFilesContents);
  });

  const referencedTags = createMemo<string[][]>(() => {
    const fileName = props.displayedReactiveFile()?.name();
    const prompt = ctx.userPrompt();
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
      });
    } else {
      setReferencedTagFileContents([]);
    }
  });

  // Notify parent of referencedTagFileContents changes
  createEffect(() => {
    props.onReferencedTagFileContentsChange?.(referencedTagFileContents);
  });

  const reducedFileContent = createMemo(() => {
    const wholeFile = props.displayedReactiveFile()?.content() ?? "";
    let reducedFile = wholeFile;
    const length = ctx.reducedFileContentLength();
    const unit = ctx.reducedFileContentUnit();

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
    props.onReducedFileContentChange?.(reducedFileContent);
  });

  // Helper for tag toggle
  function onClickTagToggle(tuple: string[]) {
    const tag = `${tuple.join(" ")}`;
    const dsbldTags = ctx.disabledTags();
    if (dsbldTags.includes(tag)) {
      ctx.setDisabledTags(dsbldTags.filter((t) => t !== tag));
    } else {
      ctx.setDisabledTags([tag, ...dsbldTags]);
    }
  }

  // Helper for file toggle
  function onClickFileToggle(name: string) {
    const dsbldFiles = ctx.disabledFiles();
    if (dsbldFiles.includes(name)) {
      ctx.setDisabledFiles(dsbldFiles.filter((f) => f !== name));
    } else {
      ctx.setDisabledFiles([name, ...dsbldFiles]);
    }
  }

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
              onclick={() => ctx.setDisabledAllTags(!ctx.disabledAllTags())}
            >
              <Switch>
                <Match when={ctx.disabledAllTags()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ctx.disabledAllTags()}>
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
                      (ctx.disabledTags().includes(`${tuple.join(" ")}`)
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
                        when={ctx.disabledTags().includes(`${tuple.join(" ")}`)}
                      >
                        <i class="bx bx-checkbox"></i>
                      </Match>
                      <Match
                        when={
                          !ctx.disabledTags().includes(`${tuple.join(" ")}`)
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
        </Show>
        <Show when={referencedFiles().length > 0}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bx-bracket"></i>
              <span>Referenzen</span>
            </div>
            <div
              class="right"
              onclick={() => ctx.setDisabledAllFiles(!ctx.disabledAllFiles())}
            >
              <Switch>
                <Match when={ctx.disabledAllFiles()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ctx.disabledAllFiles()}>
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
                      (ctx.disabledFiles().includes(`${name}`)
                        ? "disabled"
                        : "")
                    }
                    onclick={() => onClickFileToggle(name)}
                  >
                    <div>{name}</div>
                    <Switch>
                      <Match when={ctx.disabledFiles().includes(`${name}`)}>
                        <i class="bx bx-checkbox"></i>
                      </Match>
                      <Match when={!ctx.disabledFiles().includes(`${name}`)}>
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
              ctx.setDisabledSystemPrompt(!ctx.disabledSystemPrompt())
            }
          >
            <Switch>
              <Match when={ctx.disabledSystemPrompt()}>
                <i class="bx bx-square"></i>
              </Match>
              <Match when={!ctx.disabledSystemPrompt()}>
                <i class="bx bx-check-square"></i>
              </Match>
            </Switch>
          </div>
        </div>
        <textarea
          class={"prompt" + (ctx.disabledSystemPrompt() ? " disabled" : "")}
          rows={10}
          value={ctx.systemPrompt()}
          onInput={(e) => {
            ctx.setSystemPrompt(e.currentTarget.value);
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
                ctx.setDisabledFileContext(!ctx.disabledFileContext())
              }
            >
              <Switch>
                <Match when={ctx.disabledFileContext()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ctx.disabledFileContext()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="prompt_settings">
            <input
              type="number"
              value={ctx.reducedFileContentLength()}
              step={1}
              onInput={(e) => {
                ctx.setReducedFileContentLength(Number(e.currentTarget.value));
              }}
            />
            <select
              value={ctx.reducedFileContentUnit()}
              onChange={(e) => {
                ctx.setReducedFileContentUnit(
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
              "readonly_prompt" + (ctx.disabledFileContext() ? " disabled" : "")
            }
          >
            {reducedFileContent()}
          </div>
        </Show>
        <Show when={ctx.modelThoughts()}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bx-network-chart"></i>
              <span>Thoughts</span>
            </div>
            <div
              class="right"
              onclick={() => ctx.setDisabledThoughts(!ctx.disabledThoughts())}
            >
              <Switch>
                <Match when={ctx.disabledThoughts()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ctx.disabledThoughts()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>

          <div class="prompt_settings">
            <button class="" onclick={() => ctx.setModelThoughts("")}>
              Forget
            </button>
          </div>
          <div class={"prompt" + (ctx.disabledThoughts() ? " disabled" : "")}>
            {ctx.modelThoughts()}
          </div>
        </Show>
        <Show when={ctx.userPrompt()}>
          <div class="prompt_header">
            <div class="left">
              <i class="bx bxs-user-voice"></i>
              <span>User Prompt</span>
            </div>
            <div
              class="right"
              onclick={() =>
                ctx.setDisabledUserPrompt(!ctx.disabledUserPrompt())
              }
            >
              <Switch>
                <Match when={ctx.disabledUserPrompt()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!ctx.disabledUserPrompt()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class={"prompt" + (ctx.disabledUserPrompt() ? " disabled" : "")}>
            {ctx.userPrompt()}
          </div>
        </Show>
      </div>
      <div>
        <Show when={ctx.runningPrompt() !== null}>
          <button
            class="user_action yellow_border"
            onclick={() => {
              ctx.runningPrompt()?.abort();
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
