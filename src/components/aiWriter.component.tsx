import {
  ChatRequest,
  ChatResponse,
  Config,
  Message,
  ModelResponse,
  Ollama,
} from "ollama/dist/browser";
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
  Signal,
  Switch,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { storeOpenFiles } from "../functions/storeOpenFiles.function";
import { TextUnits } from "../types/textUnits.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { BasicFile } from "../types/basicFile.interface";
import { getFileContent } from "../functions/dbFilesInterface.functions";
import { AbortableAsyncIterator } from "ollama";

export const localStorageChatUserPrompt = "chatUserPrompt";
export const localStorageChatSystemPrompt = "chatSystemPrompt";
export const localStorageChatAssistentPromptLength =
  "chatAssistantPromptLength";
export const localStorageChatAssistentPromptUnit = "chatAssistantPromptUnit";
export const localStorageChatModelThoughts = "chatModelThoughts";
export const sessionStorageDisabledTags = "disabledTags";
export const sessionStorageDisabledFiles = "disabledFiles";
export const sessionStorageDisabledSysPrompt = "disabledSysPrompt";
export const sessionStorageDisabledAllTags = "disabledAllTags";
export const sessionStorageDisabledFileContext = "disabledFileContext";
export const sessionStorageDisabledAllFiles = "disabledAllFiles";
export const sessionStorageDisabledThoughts = "disabledThoughts";
export const sessionStorageDisabledUserPrompt = "disabledUserPrompt";

export function AiWriter(
  ollama: Ollama | null,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  openFiles: Accessor<ReactiveFile[]>,
  activeDirectoryParsedFileNames: Accessor<Signal<ParsedFileName[]> | null>,
  activeDirectoryName: Accessor<string | null>,
  ollamaModel: Accessor<ModelResponse | null>,
): JSXElement {
  if (ollama === null) return <div>Configure Ollama first</div>;
  if (displayedReactiveFile === null) return <div>Open a file first</div>;

  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatSystemPrompt) ?? "",
  );

  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
  );

  const [modelThoughts, setModelThoughts] = createSignal<string>(
    localStorage.getItem(localStorageChatModelThoughts) ?? "",
  );

  const [runningPrompt, setRunningPrompt] =
    createSignal<AbortableAsyncIterator<ChatResponse> | null>(null);

  const [reducedFileContentLength, setReducedFileContentLength] =
    createSignal<number>(
      Number(localStorage.getItem(localStorageChatAssistentPromptLength)),
    );

  const [reducedFileContentUnit, setReducedFileContentUnit] =
    createSignal<TextUnits>(
      (localStorage.getItem(localStorageChatAssistentPromptUnit) ??
        TextUnits.Sentences) as TextUnits,
    );

  const [disabledTags, setDisabledTags] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledTags) ?? "[]"),
  );

  const [disabledFiles, setDisabledFiles] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledFiles) ?? "[]"),
  );

  const [disabledSystemPrompt, setDisabledSystemPrompt] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledSysPrompt) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledSysPrompt,
      JSON.stringify(disabledSystemPrompt()),
    );
  });

  const [disabledAllTags, setDisabledAllTags] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledAllTags) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledAllTags,
      JSON.stringify(disabledAllTags()),
    );
  });

  const [disabledFileContext, setDisabledFileContext] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledFileContext) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledFileContext,
      JSON.stringify(disabledFileContext()),
    );
  });

  const [disabledAllFiles, setDisabledAllFiles] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledAllFiles) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledAllFiles,
      JSON.stringify(disabledAllFiles()),
    );
  });

  const [disabledThoughts, setDisabledThoughts] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledThoughts) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledThoughts,
      JSON.stringify(disabledThoughts()),
    );
  });

  const [disabledUserPrompt, setDisabledUserPrompt] = createSignal<boolean>(
    JSON.parse(
      sessionStorage.getItem(sessionStorageDisabledUserPrompt) ?? "false",
    ),
  );
  createEffect(() => {
    sessionStorage.setItem(
      sessionStorageDisabledUserPrompt,
      JSON.stringify(disabledUserPrompt()),
    );
  });

  // Memos
  const allDefinedTags = createMemo<string[][]>(() => {
    const activeDirParsedFileNames = activeDirectoryParsedFileNames();

    if (activeDirParsedFileNames) {
      return (
        activeDirParsedFileNames[0]()
          .filter((fn) => !fn.baseName && fn.tags.length > 0)
          .map((fn) => fn.tags) ?? []
      );
    }
    return [];
  });

  const referencedFiles = createMemo<string[]>(() => {
    const prompt = userPrompt();
    const fileNames = activeDirectoryParsedFileNames()?.[0]();
    const matches = prompt.match(/\[(.*?)\]/g);
    if (matches && fileNames) {
      return matches
        .map((m) => m.replace(/^\s*\[|\]\s*$/g, ""))
        .filter((m) => fileNames.find((fn) => fn.fullName === m));
    } else {
      return [];
    }
  });

  const [referencedFilesContents, setReferencedFilesContents] = createSignal<
    BasicFile[]
  >([]);

  /** Set referencedFilesContents based on referencedFiles() */
  createEffect(() => {
    const fileNames = referencedFiles();
    const activeDirName = activeDirectoryName();

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

  const referencedTags = createMemo<string[][]>(() => {
    const fileName = displayedReactiveFile()?.name();
    const prompt = userPrompt();
    return allDefinedTags().filter(
      (tag) =>
        (fileName?.includes(`${tag.join(" ")}`) &&
          fileName !== `${tag.join(" ")}`) ||
        prompt.includes(`${tag.join(" ")}`),
    );
  });

  const [referencedTagFileContents, setReferencedTagFileContents] =
    createSignal<BasicFile[]>([]);

  /** Set referencedTagFileContents based on referencedTags() */
  createEffect(() => {
    const appearingTags = referencedTags();
    const activeDirName = activeDirectoryName();
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
    }
  });

  const reducedFileContent = createMemo(() => {
    const wholeFile = displayedReactiveFile()?.content() ?? "";
    let reducedFile = wholeFile;
    const length = reducedFileContentLength();
    const unit = reducedFileContentUnit();

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
    } else if (unit === TextUnits.All) {
      reducedFile = wholeFile;
    }

    return reducedFile;
  });

  return [
    ,
    <input
      id="AIWRITER_PROMPT_INPUT"
      value={userPrompt()}
      onkeyup={(e) => {
        onAssistantPromptInputKeyUp(
          e,
          ollama,
          displayedReactiveFile,
          systemPrompt,
          openFiles,
          reducedFileContent,
          modelThoughts,
          referencedTagFileContents,
          disabledTags,
          ollamaModel,
          runningPrompt,
          setRunningPrompt,
          setUserPrompt,
          referencedFilesContents,
          disabledFiles,
          disabledAllFiles,
          disabledAllTags,
          disabledFileContext,
          disabledSystemPrompt,
          disabledThoughts,
        );
      }}
    ></input>,
    <div id="AIWRITER_TOOLBAR">
      <div id="A_T_TOP">
        <Show when={referencedTags().length > 0}>
          <div class="prompt_header rounded_top">
            <div class="left">
              <i class="bx bx-hash"></i>
              <span>Tags</span>
            </div>
            <div
              class="right"
              onclick={() => setDisabledAllTags(!disabledAllTags())}
            >
              <Switch>
                <Match when={disabledAllTags()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!disabledAllTags()}>
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
                      (disabledTags().includes(`${tuple.join(" ")}`)
                        ? "disabled"
                        : "")
                    }
                    onclick={() => {
                      onClickTagToggle(tuple, disabledTags, setDisabledTags);
                    }}
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
                        when={disabledTags().includes(`${tuple.join(" ")}`)}
                      >
                        <i class="bx bx-checkbox"></i>
                      </Match>
                      <Match
                        when={!disabledTags().includes(`${tuple.join(" ")}`)}
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
          <div class="prompt_header rounded_top">
            <div class="left">
              <i class="bx bx-bracket"></i>
              <span>Referenzen</span>
            </div>
            <div
              class="right"
              onclick={() => setDisabledAllFiles(!disabledAllFiles())}
            >
              <Switch>
                <Match when={disabledAllFiles()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!disabledAllFiles()}>
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
                      (disabledFiles().includes(`${name}`) ? "disabled" : "")
                    }
                    onclick={() => {
                      onClickFileToggle(name, disabledFiles, setDisabledFiles);
                    }}
                  >
                    <div>{name}</div>
                    <Switch>
                      <Match when={disabledFiles().includes(`${name}`)}>
                        <i class="bx bx-checkbox"></i>
                      </Match>
                      <Match when={!disabledFiles().includes(`${name}`)}>
                        <i class="bx bx-checkbox-checked"></i>
                      </Match>
                    </Switch>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
        <div class="prompt_header rounded_top">
          <div class="left">
            <i class="bx bx-info-circle"></i>
            <span>System Prompt</span>
          </div>
          <div
            class="right"
            onclick={() => setDisabledSystemPrompt(!disabledSystemPrompt())}
          >
            <Switch>
              <Match when={disabledSystemPrompt()}>
                <i class="bx bx-square"></i>
              </Match>
              <Match when={!disabledSystemPrompt()}>
                <i class="bx bx-check-square"></i>
              </Match>
            </Switch>
          </div>
        </div>
        <textarea
          class={
            "prompt rounded_bottom" +
            (disabledSystemPrompt() ? " disabled" : "")
          }
          rows={10}
          onchange={(e) => {
            setSystemPrompt(e.currentTarget.value);
            localStorage.setItem(
              localStorageChatSystemPrompt,
              e.currentTarget.value,
            );
          }}
        >
          {systemPrompt()}
        </textarea>
        <Show when={reducedFileContent()}>
          <div class="prompt_header rounded_top">
            <div>
              <i class="bx bxs-file"></i>
              <span>File Context</span>
            </div>
            <div
              class="right"
              onclick={() => setDisabledFileContext(!disabledFileContext())}
            >
              <Switch>
                <Match when={disabledFileContext()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!disabledFileContext()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div class="prompt_settings">
            <input
              type="number"
              value={reducedFileContentLength()}
              step={1}
              onchange={(e) => {
                setReducedFileContentLength(Number(e.currentTarget.value));
                localStorage.setItem(
                  localStorageChatAssistentPromptLength,
                  e.currentTarget.value,
                );
              }}
            ></input>
            <select
              value={reducedFileContentUnit()}
              onchange={(e) => {
                setReducedFileContentUnit(e.currentTarget.value as TextUnits);
                localStorage.setItem(
                  localStorageChatAssistentPromptUnit,
                  e.currentTarget.value,
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
              "readonly_prompt rounded_bottom" +
              (disabledFileContext() ? " disabled" : "")
            }
          >
            {reducedFileContent()}
          </div>
        </Show>
        <Show when={modelThoughts()}>
          <div class="prompt_header rounded_top">
            <div class="left">
              <i class="bx bx-network-chart"></i>
              <span>Thoughts</span>
            </div>
            <div
              class="right"
              onclick={() => setDisabledThoughts(!disabledThoughts())}
            >
              <Switch>
                <Match when={disabledThoughts()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!disabledThoughts()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>

          <div class="prompt_settings">
            <button
              class=""
              onclick={() => {
                generateAssistantThoughts(
                  userPrompt(),
                  ollama,
                  displayedReactiveFile,
                  systemPrompt,
                  openFiles,
                  reducedFileContent,
                  modelThoughts,
                  setModelThoughts,
                  referencedTagFileContents,
                  disabledTags,
                  ollamaModel,
                  runningPrompt,
                  setRunningPrompt,
                  referencedFilesContents,
                  disabledFiles,
                  disabledAllFiles,
                  disabledAllTags,
                  disabledFileContext,
                  disabledSystemPrompt,
                  disabledThoughts,
                );
              }}
            >
              Deepen
            </button>
            <button
              class=""
              onclick={() => {
                setModelThoughts("");
              }}
            >
              Forget
            </button>
          </div>
          <div
            class={
              "prompt rounded_bottom" + (disabledThoughts() ? " disabled" : "")
            }
          >
            {modelThoughts()}
          </div>
        </Show>
        <Show when={userPrompt()}>
          <div class="prompt_header rounded_top">
            <div class="left">
              <i class="bx bxs-user-voice"></i>
              <span>User Prompt</span>
            </div>
            <div
              class="right"
              onclick={() => setDisabledUserPrompt(!disabledUserPrompt())}
            >
              <Switch>
                <Match when={disabledUserPrompt()}>
                  <i class="bx bx-square"></i>
                </Match>
                <Match when={!disabledUserPrompt()}>
                  <i class="bx bx-check-square"></i>
                </Match>
              </Switch>
            </div>
          </div>
          <div
            class={
              "prompt rounded_bottom" +
              (disabledUserPrompt() ? " disabled" : "")
            }
          >
            {userPrompt()}
          </div>
        </Show>
      </div>
      <div>
        <Show when={runningPrompt() !== null}>
          <button
            class="user_action yellow_border rounded_right rounded_left"
            onclick={() => {
              runningPrompt()?.abort();
            }}
          >
            Abort
            <i class="bx bx-block yellow_dim" />
          </button>
        </Show>
        <button
          class="user_action rounded_right rounded_left"
          onclick={() => {
            generateAssistantThoughts(
              userPrompt(),
              ollama,
              displayedReactiveFile,
              systemPrompt,
              openFiles,
              reducedFileContent,
              modelThoughts,
              setModelThoughts,
              referencedTagFileContents,
              disabledTags,
              ollamaModel,
              runningPrompt,
              setRunningPrompt,
              referencedFilesContents,
              disabledFiles,
              disabledAllFiles,
              disabledAllTags,
              disabledFileContext,
              disabledSystemPrompt,
              disabledThoughts,
            );
          }}
        >
          Consider
          <i class="bx bx-network-chart" />
        </button>
        <button
          class="user_action rounded_right rounded_left"
          onclick={() => {
            generateAssistantResponse(
              userPrompt(),
              ollama,
              displayedReactiveFile,
              systemPrompt,
              openFiles,
              reducedFileContent,
              modelThoughts,
              referencedTagFileContents,
              disabledTags,
              ollamaModel,
              runningPrompt,
              setRunningPrompt,
              referencedFilesContents,
              disabledFiles,
              disabledAllFiles,
              disabledAllTags,
              disabledFileContext,
              disabledSystemPrompt,
              disabledThoughts,
            );
          }}
        >
          Continue Text
          <i class="bx bx-play-circle" />
        </button>
      </div>
    </div>,
  ];
}

function onAssistantPromptInputKeyUp(
  e: KeyboardEvent & { currentTarget: HTMLInputElement; target: Element },
  ollama: Ollama,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  systemPrompt: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
  reducedFileContent: Accessor<string>,
  modelThoughts: Accessor<string>,
  referencedTagFileContents: Accessor<BasicFile[]>,
  disabledTags: Accessor<string[]>,
  ollamaModel: Accessor<ModelResponse | null>,
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>,
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>,
  setUserPrompt: Setter<string>,
  referencedFilesContent: Accessor<BasicFile[]>,
  disabledFiles: Accessor<string[]>,
  disabledAllFiles: Accessor<boolean>,
  disabledAllTags: Accessor<boolean>,
  disabledFileContext: Accessor<boolean>,
  disabledSystemPrompt: Accessor<boolean>,
  disabledThoughts: Accessor<boolean>,
) {
  switch (e.key) {
    case "Enter":
      generateAssistantResponse(
        e.currentTarget.value,
        ollama,
        displayedReactiveFile,
        systemPrompt,
        openFiles,
        reducedFileContent,
        modelThoughts,
        referencedTagFileContents,
        disabledTags,
        ollamaModel,
        runningPrompt,
        setRunningPrompt,
        referencedFilesContent,
        disabledFiles,
        disabledAllFiles,
        disabledAllTags,
        disabledFileContext,
        disabledSystemPrompt,
        disabledThoughts,
      );
      break;
  }
  setUserPrompt(e.currentTarget.value);
  localStorage.setItem(localStorageChatUserPrompt, e.currentTarget.value);
}

function generateAssistantResponse(
  userPrompt: string,
  ollama: Ollama,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  systemPrompt: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
  reducedFileContent: Accessor<string>,
  modelThoughts: Accessor<string>,
  referencedTagFileContents: Accessor<BasicFile[]>,
  disabledTags: Accessor<string[]>,
  ollamaModel: Accessor<ModelResponse | null>,
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>,
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>,
  referencedFilesContent: Accessor<BasicFile[]>,
  disabledFiles: Accessor<string[]>,
  disabledAllFiles: Accessor<boolean>,
  disabledAllTags: Accessor<boolean>,
  disabledFileContext: Accessor<boolean>,
  disabledSysPrompt: Accessor<boolean>,
  disabledThoughts: Accessor<boolean>,
) {
  const thoughts = modelThoughts();
  const messages: Message[] = [];
  const fileContent = reducedFileContent();
  const tagFileContents = referencedTagFileContents();
  const dsbldTags = disabledTags();
  const fileContents = referencedFilesContent();
  const dsbldFiles = disabledFiles();
  const llmModel = ollamaModel();

  if (llmModel === undefined || llmModel?.model === undefined) {
    return;
  }

  if (tagFileContents.length > 0 && !disabledAllTags()) {
    messages.push({
      role: "system",
      content: tagFileContents
        .filter((tfc) => !dsbldTags.includes(tfc.name))
        .map((tfc) => tfc.content)
        .join("\n"),
    });
  }
  if (fileContents.length > 0 && !disabledAllFiles()) {
    messages.push({
      role: "system",
      content: fileContents
        .filter((fc) => !dsbldFiles.includes(fc.name))
        .map((fc) => fc.content)
        .join("\n"),
    });
  }
  if (!disabledSysPrompt()) {
    messages.push({
      role: "system",
      content: systemPrompt(),
    });
  }

  if (thoughts && !disabledThoughts()) {
    messages.push({
      role: "assistant",
      content: thoughts,
    });
  }
  if (fileContent && !disabledFileContext()) {
    messages.push({
      role: "assistant",
      content: fileContent,
    });
  }
  if (userPrompt) {
    messages.push({
      role: "user",
      content: userPrompt,
    });
  }

  const request: ChatRequest & { stream: true } = {
    model: llmModel.model,
    stream: true,
    think: false,
    messages,
  };
  ollama.chat(request).then(async (responseStream) => {
    setRunningPrompt(responseStream);
    try {
      for await (const response of responseStream) {
        displayedReactiveFile()?.setContent(
          (prevContent) => prevContent + response.message.content,
        );
        if (response.done) {
          storeOpenFiles(openFiles);
          setRunningPrompt(null);
        }
      }
    } catch (error) {
      setRunningPrompt(null);
      console.error("Error processing chat response:", error);
    }
  });
}

function generateAssistantThoughts(
  userPrompt: string,
  ollama: Ollama,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  systemPrompt: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
  reducedFileContent: Accessor<string>,
  modelThoughts: Accessor<string>,
  setModelThoughts: Setter<string>,
  referencedTagFileContents: Accessor<BasicFile[]>,
  disabledTags: Accessor<string[]>,
  ollamaModel: Accessor<ModelResponse | null>,
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>,
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>,
  referencedFilesContent: Accessor<BasicFile[]>,
  disabledFiles: Accessor<string[]>,
  disabledAllFiles: Accessor<boolean>,
  disabledAllTags: Accessor<boolean>,
  disabledFileContext: Accessor<boolean>,
  disabledSystemPrompt: Accessor<boolean>,
  disabledThoughts: Accessor<boolean>,
) {
  const messages: Message[] = [];
  const thoughts = modelThoughts();
  const fileContent = reducedFileContent();
  const tagFileContents = referencedTagFileContents();
  const fileContents = referencedFilesContent();
  const llmModel = ollamaModel();

  if (llmModel === undefined || llmModel?.model === undefined) {
    return;
  }

  if (tagFileContents.length > 0 && !disabledAllTags()) {
    messages.push({
      role: "system",
      content: tagFileContents
        .filter((tfc) => !disabledTags().includes(tfc.name))
        .map((tfc) => tfc.content)
        .join("\n"),
    });
  }
  if (fileContents.length > 0 && !disabledAllFiles()) {
    messages.push({
      role: "system",
      content: fileContents
        .filter((fc) => !disabledFiles().includes(fc.name))
        .map((fc) => fc.content)
        .join("\n"),
    });
  }
  if (!disabledSystemPrompt()) {
    messages.push({
      role: "system",
      content: systemPrompt(),
    });
  }

  if (thoughts && !disabledThoughts()) {
    messages.push({
      role: "assistant",
      content: thoughts,
    });
  }
  if (fileContent && !disabledFileContext()) {
    messages.push({
      role: "assistant",
      content: fileContent,
    });
  }
  if (userPrompt) {
    messages.push({
      role: "user",
      content: userPrompt,
    });
  }

  const request: ChatRequest & { stream: true } = {
    model: llmModel.model,
    stream: true,
    //think: true,
    messages,
    options: {
      stop: ["</think>"],
    },
  };
  ollama.chat(request).then(async (responseStream) => {
    setRunningPrompt(responseStream);
    try {
      setModelThoughts("");
      let totalMessage = "";
      for await (const response of responseStream) {
        totalMessage += response.message.content;
        setModelThoughts(
          (prevContent) => prevContent + response.message.content,
        );
        if (response.done) {
          if (totalMessage.startsWith("<think>")) {
            setModelThoughts((prevContent) => prevContent + "</think>");
          }
          storeOpenFiles(openFiles);
          setRunningPrompt(null);
        }
      }
    } catch (error) {
      setRunningPrompt(null);
      console.error("Error processing chat response:", error);
    }
  });
}

function onClickTagToggle(
  tuple: string[],
  disabledTags: Accessor<string[]>,
  setDisabledTags: Setter<string[]>,
) {
  const tag = `${tuple.join(" ")}`;
  const dsbldTags = disabledTags();
  if (dsbldTags.includes(tag)) {
    setDisabledTags(dsbldTags.filter((t) => t !== tag));
  } else {
    setDisabledTags([tag, ...dsbldTags]);
  }
  sessionStorage.setItem(
    sessionStorageDisabledTags,
    JSON.stringify(disabledTags()),
  );
}

function onClickFileToggle(
  name: string,
  disabledNames: Accessor<string[]>,
  setDisabledNames: Setter<string[]>,
) {
  const nm = `${name}`;
  const dsbldTags = disabledNames();
  if (dsbldTags.includes(name)) {
    setDisabledNames(dsbldTags.filter((t) => t !== name));
  } else {
    setDisabledNames([name, ...dsbldTags]);
  }
  sessionStorage.setItem(
    sessionStorageDisabledFiles,
    JSON.stringify(disabledNames()),
  );
}
