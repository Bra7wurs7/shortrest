import { AbortableAsyncIterator } from "ollama";
import { ChatRequest, ChatResponse, Config, Ollama } from "ollama/dist/browser";
import { Accessor, createSignal, JSXElement, Signal } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { storeOpenFiles } from "../functions/storeOpenFiles.function";

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
    "you are visualAIzor, an artificial intelligence trained to elaborate, concretize and develop visual concepts for images. The user may provide with brief visual concepts and ideas. Try to consider these ideas and how to extend on them. Always condense your thoughts into a concrete transcription of the visual details of the scene and subject.",
  );

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
          rows={7}
          onchange={(e) => {
            setSystemPrompt(e.currentTarget.value);
          }}
        >
          {systemPrompt()}
        </textarea>
      </div>
      <div>
        <div class="user_action">
          Undo Changes
          <i class="bx bx-skip-previous-circle" />
        </div>
        <div class="user_action">
          Continue Text
          <i class="bx bx-play-circle" />
        </div>
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
      ollama
        .chat(request)
        .then(async (responseStream: AbortableAsyncIterator<ChatResponse>) => {
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
