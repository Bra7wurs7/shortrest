import { AbortableAsyncIterator } from "ollama";
import { ChatRequest, ChatResponse, Config, Ollama } from "ollama/dist/browser";
import { Accessor, createSignal, JSXElement, Signal } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";

export function Chat(
  ollama: Ollama | null,
  displayedReactiveFile: ReactiveFile | null,
): JSXElement {
  if (ollama === null) return <div>Configure Ollama first</div>;
  if (displayedReactiveFile === null) return <div>Open a file first</div>;

  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    "You are a large language model used to continue any kind of text",
  );

  return [
    <div id="ASSISTANT_HISTORY">{displayedReactiveFile.content()}</div>,
    <input
      id="ASSISTANT_PROMPT_INPUT"
      onkeyup={(e) => {
        onAssistantPromptInputKeyUp(
          e,
          ollama,
          displayedReactiveFile,
          systemPrompt,
        );
      }}
    ></input>,
    <div id="ASSISTANT_TOOLBAR">
      <div>
        <textarea
          class="system_prompt"
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
              console.log("Received response:", response);
              displayedReactiveFile.setContent(
                (prevContent) => prevContent + response.message.content,
              );
            }
          } catch (error) {
            console.error("Error processing chat response:", error);
          }
        });
      break;
  }
}
