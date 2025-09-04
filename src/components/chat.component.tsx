import { ChatRequest, ChatResponse, Config, Ollama } from "ollama/dist/browser";
import {
  Accessor,
  createMemo,
  createSignal,
  JSXElement,
  Signal,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { storeOpenFiles } from "../functions/storeOpenFiles.function";
import { TextUnits } from "../types/textUnits.enum";

export const localStorageChatUserInput = "chatUserInput";
export const localStorageChatSystemPrompt = "chatSystemPrompt";

export function Chat(
  ollama: Ollama | null,
  displayedReactiveFile: ReactiveFile | null,
  openFiles: Accessor<ReactiveFile[]>,
): JSXElement {
  if (ollama === null) return <div>Configure Ollama first</div>;
  if (displayedReactiveFile === null) return <div>Open a file first</div>;

  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatSystemPrompt) ?? "",
  );

  const [reducedFileContentLength, setReducedFileContentLength] =
    createSignal<number>(1);
  const [reducedFileContentUnit, setReducedFileContentUnit] =
    createSignal<TextUnits>(TextUnits.Sentences);

  const reducedFileContent = createMemo(() => {
    const wholeFile = displayedReactiveFile.content();
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
      id="ASSISTANT_HISTORY"
      value={displayedReactiveFile.content()}
      onchange={(e) => {
        displayedReactiveFile.setContent(e.currentTarget.value);
        storeOpenFiles(openFiles);
      }}
    />,
    <input
      id="ASSISTANT_PROMPT_INPUT"
      onkeyup={(e) => {
        onAssistantPromptInputKeyUp(
          e,
          ollama,
          displayedReactiveFile,
          systemPrompt,
          openFiles,
        );
      }}
    ></input>,
    <div id="ASSISTANT_TOOLBAR">
      <div>
        <div class="prompt_header">
          <i class="bx bx-info-circle"></i>
          <span>System Prompt</span>
        </div>
        <textarea
          class="prompt"
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
        <div class="prompt_header">
          <i class="bx bxs-log-in-circle"></i>
          <span>Continue here</span>
        </div>
        <div class="prompt">{reducedFileContent()}</div>
      </div>
      <div>
        <button class="user_action">
          Undo Changes
          <i class="bx bx-skip-previous-circle" />
        </button>
        <button class="user_action">
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
  displayedReactiveFile: ReactiveFile,
  systemPrompt: Accessor<string>,
  openFiles: Accessor<ReactiveFile[]>,
) {
  switch (e.key) {
    case "Enter":
      const request: ChatRequest & { stream: true } = {
        model: "dolphin-mistral",
        stream: true,
        messages: [
          {
            role: "system",
            content: systemPrompt(),
          },
          {
            role: "assistant",
            content: displayedReactiveFile.content(),
          },
          {
            role: "user",
            content: e.currentTarget.value,
          },
        ],
      };
      ollama.chat(request).then(async (responseStream) => {
        try {
          for await (const response of responseStream) {
            displayedReactiveFile.setContent(
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
      break;
  }
}
