import { Accessor, JSXElement } from "solid-js";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

export function MdReader(content: Accessor<string>): JSXElement {
  return [
    <div
      id="MARKDOWN_READER"
      innerHTML={micromark(content() ?? "", {
        extensions: [gfm()],
        htmlExtensions: [gfmHtml()],
      })}
    ></div>,
  ];
}
