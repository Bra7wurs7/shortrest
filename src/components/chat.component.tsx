import { ChatRequest, ChatResponse, Config, Ollama } from "ollama/dist/browser";
import {
  Accessor,
  createMemo,
  createSignal,
  JSXElement,
  Setter,
  Show,
  Signal,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { storeOpenFiles } from "../functions/storeOpenFiles.function";
import { TextUnits } from "../types/textUnits.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";

export const localStorageChatUserPrompt = "chatUserPrompt";
export const localStorageChatSystemPrompt = "chatSystemPrompt";
export const localStorageChatAssistentPromptLength =
  "chatAssistantPromptLength";
export const localStorageChatAssistentPromptUnit = "chatAssistantPromptUnit";
export const localStorageChatModelThoughts = "chatModelThoughts";

export function Chat(
  ollama: Ollama | null,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  openFiles: Accessor<ReactiveFile[]>,
  activeDirectoryParsedFileNames: Accessor<Signal<ParsedFileName[]> | null>,
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

  const [reducedFileContentLength, setReducedFileContentLength] =
    createSignal<number>(
      Number(localStorage.getItem(localStorageChatAssistentPromptLength)),
    );
  const [reducedFileContentUnit, setReducedFileContentUnit] =
    createSignal<TextUnits>(
      (localStorage.getItem(localStorageChatAssistentPromptUnit) ??
        TextUnits.Sentences) as TextUnits,
    );

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
    <textarea
      id="AIWRITER_HISTORY"
      value={displayedReactiveFile()?.content() ?? ""}
      onkeyup={(e) => {
        displayedReactiveFile()?.setContent(e.currentTarget.value);
      }}
      onchange={(e) => {
        storeOpenFiles(openFiles);
      }}
    />,
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
          setModelThoughts,
        );
        setUserPrompt(e.currentTarget.value);
        localStorage.setItem(localStorageChatUserPrompt, e.currentTarget.value);
      }}
    ></input>,
    <div id="AIWRITER_TOOLBAR">
      <div id="A_T_TOP">
        <div class="prompt_header rounded_top">
          <i class="bx bx-info-circle"></i>
          <span>System Prompt</span>
        </div>
        <textarea
          class="prompt rounded_bottom"
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
            <i class="bx bxs-log-out-circle"></i>
            <span>Assistant Context</span>
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
          <div class="prompt rounded_bottom">{reducedFileContent()}</div>
        </Show>
        <Show when={modelThoughts()}>
          <div class="prompt_header rounded_top">
            <i class="bx bx-folder"></i>
            <span>Thoughts</span>
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
          <div class="prompt rounded_bottom">{modelThoughts()}</div>
        </Show>
        <Show when={userPrompt()}>
          <div class="prompt_header rounded_top">
            <i class="bx bxs-log-in-circle"></i>
            <span>User Prompt</span>
          </div>
          <div class="prompt rounded_bottom">{userPrompt()}</div>
        </Show>
      </div>
      <div>
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
            );
          }}
        >
          Consider
          <i class="bx bx-network-chart" />
        </button>
        <button
          class="user_action rounded_right"
          onclick={() => {
            generateAssistantResponse(
              userPrompt(),
              ollama,
              displayedReactiveFile,
              systemPrompt,
              openFiles,
              reducedFileContent,
              modelThoughts,
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
  setModelThoughts: Setter<string>,
) {
  switch (e.key) {
    case "Enter":
      displayedReactiveFile()?.setContent((prev) =>
        prev
          ? prev + "\n> " + e.currentTarget.value + "\n"
          : "> " + e.currentTarget.value + "\n",
      );
      generateAssistantResponse(
        e.currentTarget.value,
        ollama,
        displayedReactiveFile,
        systemPrompt,
        openFiles,
        reducedFileContent,
        modelThoughts,
      );
      break;
  }
}

function generateAssistantResponse(
  userPrompt: string,
  ollama: Ollama,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  systemPrompt: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
  reducedFileContent: Accessor<string>,
  modelThoughts: Accessor<string>,
) {
  const request: ChatRequest & { stream: true } = {
    model: "dolphin-phi",
    stream: true,
    //think: true,
    messages: [
      {
        role: "system",
        content: systemPrompt(),
      },
      {
        role: "assistant",
        content: reducedFileContent(),
      },
      {
        role: "assistant",
        content: reducedFileContent(),
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };
  ollama.chat(request).then(async (responseStream) => {
    try {
      for await (const response of responseStream) {
        displayedReactiveFile()?.setContent(
          (prevContent) => prevContent + response.message.content,
        );
        if (response.done) {
          storeOpenFiles(openFiles);
        }
      }
    } catch (error) {
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
) {
  const request: ChatRequest & { stream: true } = {
    model: "dolphin-phi",
    stream: true,
    messages: [
      {
        role: "system",
        content: systemPrompt(),
      },
      {
        role: "assistant",
        content: modelThoughts(),
      },
      {
        role: "assistant",
        content: reducedFileContent(),
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    options: {
      stop: ["</think>"],
    },
  };
  ollama.chat(request).then(async (responseStream) => {
    try {
      setModelThoughts("");
      let totalMessage = "";
      for await (const response of responseStream) {
        console.log(response);
        totalMessage += response.message.content;
        setModelThoughts(
          (prevContent) => prevContent + response.message.content,
        );
        if (response.done) {
          if (totalMessage.startsWith("<think>")) {
            setModelThoughts((prevContent) => prevContent + "</think>");
          }
          storeOpenFiles(openFiles);
        }
      }
    } catch (error) {
      console.error("Error processing chat response:", error);
    }
  });
}
