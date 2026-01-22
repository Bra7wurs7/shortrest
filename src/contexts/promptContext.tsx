import {
  Accessor,
  createContext,
  createEffect,
  createSignal,
  JSXElement,
  Setter,
  useContext,
} from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";
import { TextUnits } from "../types/textUnits.enum";

// localStorage keys
export const localStorageChatUserPrompt = "chatUserPrompt";
export const localStorageChatSystemPrompt = "chatSystemPrompt";
export const localStorageChatAssistentPromptLength = "chatAssistantPromptLength";
export const localStorageChatAssistentPromptUnit = "chatAssistantPromptUnit";
export const localStorageChatModelThoughts = "chatModelThoughts";

// sessionStorage keys
export const sessionStorageDisabledTags = "disabledTags";
export const sessionStorageDisabledFiles = "disabledFiles";
export const sessionStorageDisabledSysPrompt = "disabledSysPrompt";
export const sessionStorageDisabledAllTags = "disabledAllTags";
export const sessionStorageDisabledFileContext = "disabledFileContext";
export const sessionStorageDisabledAllFiles = "disabledAllFiles";
export const sessionStorageDisabledThoughts = "disabledThoughts";
export const sessionStorageDisabledUserPrompt = "disabledUserPrompt";

export interface PromptContextValue {
  // Core prompts
  userPrompt: Accessor<string>;
  setUserPrompt: Setter<string>;
  systemPrompt: Accessor<string>;
  setSystemPrompt: Setter<string>;
  modelThoughts: Accessor<string>;
  setModelThoughts: Setter<string>;

  // Toggle signals for disabling parts of the prompt
  disabledTags: Accessor<string[]>;
  setDisabledTags: Setter<string[]>;
  disabledFiles: Accessor<string[]>;
  setDisabledFiles: Setter<string[]>;
  disabledSystemPrompt: Accessor<boolean>;
  setDisabledSystemPrompt: Setter<boolean>;
  disabledAllTags: Accessor<boolean>;
  setDisabledAllTags: Setter<boolean>;
  disabledFileContext: Accessor<boolean>;
  setDisabledFileContext: Setter<boolean>;
  disabledAllFiles: Accessor<boolean>;
  setDisabledAllFiles: Setter<boolean>;
  disabledThoughts: Accessor<boolean>;
  setDisabledThoughts: Setter<boolean>;
  disabledUserPrompt: Accessor<boolean>;
  setDisabledUserPrompt: Setter<boolean>;

  // File content reduction settings
  reducedFileContentLength: Accessor<number>;
  setReducedFileContentLength: Setter<number>;
  reducedFileContentUnit: Accessor<TextUnits>;
  setReducedFileContentUnit: Setter<TextUnits>;

  // Running state for abort functionality
  runningPrompt: Accessor<AbortableAsyncIterator<ChatResponse> | null>;
  setRunningPrompt: Setter<AbortableAsyncIterator<ChatResponse> | null>;
}

const PromptContext = createContext<PromptContextValue>();

export function PromptProvider(props: { children: JSXElement }): JSXElement {
  // Core prompts - persisted to localStorage
  const [userPrompt, setUserPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatUserPrompt) ?? "",
  );
  const [systemPrompt, setSystemPrompt] = createSignal<string>(
    localStorage.getItem(localStorageChatSystemPrompt) ?? "",
  );
  const [modelThoughts, setModelThoughts] = createSignal<string>(
    localStorage.getItem(localStorageChatModelThoughts) ?? "",
  );

  // Persist core prompts to localStorage
  createEffect(() => {
    localStorage.setItem(localStorageChatUserPrompt, userPrompt());
  });
  createEffect(() => {
    localStorage.setItem(localStorageChatSystemPrompt, systemPrompt());
  });
  createEffect(() => {
    localStorage.setItem(localStorageChatModelThoughts, modelThoughts());
  });

  // Toggle signals - persisted to sessionStorage
  const [disabledTags, setDisabledTags] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledTags) ?? "[]"),
  );
  const [disabledFiles, setDisabledFiles] = createSignal<string[]>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledFiles) ?? "[]"),
  );
  const [disabledSystemPrompt, setDisabledSystemPrompt] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledSysPrompt) ?? "false"),
  );
  const [disabledAllTags, setDisabledAllTags] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledAllTags) ?? "false"),
  );
  const [disabledFileContext, setDisabledFileContext] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledFileContext) ?? "false"),
  );
  const [disabledAllFiles, setDisabledAllFiles] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledAllFiles) ?? "false"),
  );
  const [disabledThoughts, setDisabledThoughts] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledThoughts) ?? "false"),
  );
  const [disabledUserPrompt, setDisabledUserPrompt] = createSignal<boolean>(
    JSON.parse(sessionStorage.getItem(sessionStorageDisabledUserPrompt) ?? "false"),
  );

  // Persist toggles to sessionStorage
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledTags, JSON.stringify(disabledTags()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledFiles, JSON.stringify(disabledFiles()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledSysPrompt, JSON.stringify(disabledSystemPrompt()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledAllTags, JSON.stringify(disabledAllTags()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledFileContext, JSON.stringify(disabledFileContext()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledAllFiles, JSON.stringify(disabledAllFiles()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledThoughts, JSON.stringify(disabledThoughts()));
  });
  createEffect(() => {
    sessionStorage.setItem(sessionStorageDisabledUserPrompt, JSON.stringify(disabledUserPrompt()));
  });

  // File content reduction settings - persisted to localStorage
  const [reducedFileContentLength, setReducedFileContentLength] = createSignal<number>(
    Number(localStorage.getItem(localStorageChatAssistentPromptLength)) || 0,
  );
  const [reducedFileContentUnit, setReducedFileContentUnit] = createSignal<TextUnits>(
    (localStorage.getItem(localStorageChatAssistentPromptUnit) ?? TextUnits.Sentences) as TextUnits,
  );

  // Persist file content settings to localStorage
  createEffect(() => {
    localStorage.setItem(
      localStorageChatAssistentPromptLength,
      String(reducedFileContentLength()),
    );
  });
  createEffect(() => {
    localStorage.setItem(localStorageChatAssistentPromptUnit, reducedFileContentUnit());
  });

  // Running state (not persisted)
  const [runningPrompt, setRunningPrompt] =
    createSignal<AbortableAsyncIterator<ChatResponse> | null>(null);

  const contextValue: PromptContextValue = {
    userPrompt,
    setUserPrompt,
    systemPrompt,
    setSystemPrompt,
    modelThoughts,
    setModelThoughts,
    disabledTags,
    setDisabledTags,
    disabledFiles,
    setDisabledFiles,
    disabledSystemPrompt,
    setDisabledSystemPrompt,
    disabledAllTags,
    setDisabledAllTags,
    disabledFileContext,
    setDisabledFileContext,
    disabledAllFiles,
    setDisabledAllFiles,
    disabledThoughts,
    setDisabledThoughts,
    disabledUserPrompt,
    setDisabledUserPrompt,
    reducedFileContentLength,
    setReducedFileContentLength,
    reducedFileContentUnit,
    setReducedFileContentUnit,
    runningPrompt,
    setRunningPrompt,
  };

  return (
    <PromptContext.Provider value={contextValue}>
      {props.children}
    </PromptContext.Provider>
  );
}

export function usePromptContext(): PromptContextValue {
  const ctx = useContext(PromptContext);
  if (!ctx) {
    throw new Error("usePromptContext must be used within a PromptProvider");
  }
  return ctx;
}
