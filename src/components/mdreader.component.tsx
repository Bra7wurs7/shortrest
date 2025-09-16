import { Accessor, JSXElement } from "solid-js";
import { ReactiveFile } from "../types/reactiveFile.interface";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export const localStorageChatUserPrompt = "chatUserPrompt";
export const localStorageChatSystemPrompt = "chatSystemPrompt";
export const localStorageChatAssistentPromptLength =
  "chatAssistantPromptLength";
export const localStorageChatAssistentPromptUnit = "chatAssistantPromptUnit";
export const localStorageChatModelThoughts = "chatModelThoughts";

export function MdReader(
  displayedReactiveFile: Accessor<ReactiveFile | null>,
): JSXElement {
  console.log();
  return [
    <div
      id="MARKDOWN_READER"
      innerHTML={micromark(displayedReactiveFile()?.content() ?? "", {
        extensions: [gfm()], // <-- This tells the parser how to recognize table syntax
        htmlExtensions: [gfmHtml()], // <-- This tells the compiler how to create <table>, <tr>, etc.
      })}
    ></div>,
  ];
}
