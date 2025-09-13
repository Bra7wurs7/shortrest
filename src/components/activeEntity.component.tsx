import { ChatRequest, ChatResponse, Config, Ollama } from "ollama/dist/browser";
import {
  Accessor,
  createMemo,
  createSignal,
  For,
  JSXElement,
  Show,
  Signal,
} from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { storeOpenFiles } from "../functions/storeOpenFiles.function";
import { TextUnits } from "../types/textUnits.enum";

export const localStorageChatUserPrompt = "activeEntityUserPrompt";
export const localStorageChatSystemPrompt = "activeEntitySystemPrompt";
export const localStorageChatAssistentPromptLength =
  "activeEntityAssistantPromptLength";
export const localStorageChatAssistentPromptUnit =
  "activeEntityAssistantPromptUnit";

export function ActiveEntity(
  ollama: Ollama | null,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  openFiles: Accessor<ReactiveFile[]>,
): JSXElement {
  if (ollama === null) return <div>Configure Ollama first</div>;
  if (displayedReactiveFile === null) return <div>Open a file first</div>;

  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatSystemPrompt) ?? "",
  );
  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
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
      id="CHARACTER_SHEET_LOG"
      value={displayedReactiveFile()?.content() ?? ""}
      onkeyup={(e) => {
        displayedReactiveFile()?.setContent(e.currentTarget.value);
      }}
      onchange={(e) => {
        storeOpenFiles(openFiles);
      }}
    />,
    <input
      id="CHARACTER_SHEET_PROMPT"
      value={userPrompt()}
      onkeyup={(e) => {
        onAssistantPromptInputKeyUp(
          e,
          ollama,
          displayedReactiveFile,
          systemPrompt,
          openFiles,
          reducedFileContent,
        );
        setUserPrompt(e.currentTarget.value);
        localStorage.setItem(localStorageChatUserPrompt, e.currentTarget.value);
      }}
    ></input>,
    <div id="CHARACTER_SHEET_TOOLBAR">
      <div id="CHARACTER_SHEET_TOOLBAR_TOP">
        <button class={"character_name"}>
          <div class="filename">{"Snaf"}</div>
          <div class="tags">
            <For each={["Koch"]}>
              {(tag: string) => <span>&nbsp;#{tag}</span>}
            </For>
          </div>
        </button>
        <div class="talents_grid">
          <div class="const grid_item">
            <div class="icon">
              <i class="bx bxs-heart"></i>
            </div>
            <div class="mod">+2</div>
          </div>
          <div class="str grid_item">
            <div class="icon">
              <i class="bx bxs-hand"></i>
            </div>
            <div class="mod">+0</div>
          </div>
          <div class="dex grid_item">
            <div class="icon">
              <i class="bx bx-pulse"></i>
            </div>
            <div class="mod">+1</div>
          </div>
          <div class="kno grid_item">
            <div class="icon">
              <i class="bx bxs-book"></i>
            </div>
            <div class="mod">+2</div>
          </div>
          <div class="rea grid_item">
            <div class="icon">
              <i class="bx bxs-brain"></i>
            </div>
            <div class="mod">+0</div>
          </div>
          <div class="confi grid_item">
            <div class="icon">
              <i class="bx bxs-hot"></i>
            </div>
            <div class="mod">+0</div>
          </div>
        </div>

        <div>
          <div class="skill">
            <div>Swords</div>
            <div>+1</div>
          </div>
          <div class="skill">
            <div>Poles</div>
            <div>+2</div>
          </div>
          <div class="skill">
            <div>Shields</div>
            <div>+2</div>
          </div>
          <div class="skill">
            <div>Cooking</div>
            <div>+3</div>
          </div>
          <div class="skill">
            <div>Intimidation</div>
            <div>+1</div>
          </div>
          <div class="skill">
            <div>Persuasion</div>
            <div>+2</div>
          </div>
          <div class="skill">
            <div>Biology</div>
            <div>+1</div>
          </div>
        </div>

        <div class="rules_buttons">
          <button>Equipment</button>
          <button>Conditions</button>
          <button>Traits</button>
        </div>

        <div class="rules_list">
          <div class="rule">a</div>
          <div class="rule">a</div>
          <div class="rule">a</div>
          <div class="rule">a</div>
        </div>
      </div>
      <div>
        <button class="user_action rounded_right">
          Thought
          <i class="bx bxs-network-chart" />
        </button>

        <button class="user_action rounded_right">
          Action
          <i class="bx bxs-hand" />
        </button>

        <div class="action_selection">
          <select class="action_options">
            <option>Slash</option>
            <option>Smash</option>
          </select>
          <select class="action_options">
            <option>Destroy</option>
            <option>Cause Pain</option>
          </select>
        </div>
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
) {
  switch (e.key) {
    case "Enter":
      break;
  }
}

/** This should take some context  */
function generateEffect(
  userPrompt: string,
  ollama: Ollama,
  displayedReactiveFile: Accessor<ReactiveFile | null>,
  systemPrompt: Accessor<string>,
) {
  const request: ChatRequest & { stream: true } = {
    model: "qwen3:4b",
    stream: true,
    messages: [
      {
        role: "system",
        content: systemPrompt(),
      },
      {
        role: "assistant",
        content: "",
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
      }
    } catch (error) {
      console.error("Error processing chat response:", error);
    }
  });
}
