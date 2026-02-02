import { onMount, onCleanup, createEffect, type Accessor } from "solid-js";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const gruvboxTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--color_background_soft)",
    color: "var(--color_foreground_hard)",
    fontFamily: "var(--sans)",
    fontSize: "inherit",
    flexGrow: "1",
    border: "var(--size_border) var(--style_border) transparent",
    transition: "var(--transition_border_color)",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--color_foreground_soft)",
  },
  ".cm-content": {
    padding: "var(--size_padding_large)",
    caretColor: "var(--color_foreground_hard)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color_foreground_hard)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
    {
      backgroundColor: "var(--dark2)",
    },
  ".cm-gutters": {
    backgroundColor: "var(--color_background_hard)",
    color: "var(--dark4)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--color_background)",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

const gruvboxHighlighting = HighlightStyle.define([
  { tag: t.heading1, color: "var(--red)", fontWeight: "bold" },
  { tag: t.heading2, color: "var(--orange)", fontWeight: "bold" },
  { tag: t.heading3, color: "var(--yellow)", fontWeight: "bold" },
  { tag: t.heading4, color: "var(--green)", fontWeight: "bold" },
  { tag: t.heading5, color: "var(--aqua)", fontWeight: "bold" },
  { tag: t.heading6, color: "var(--blue)", fontWeight: "bold" },
  { tag: t.emphasis, color: "var(--green)", fontStyle: "italic" },
  { tag: t.strong, color: "var(--orange)", fontWeight: "bold" },
  { tag: t.link, color: "var(--blue)", textDecoration: "underline" },
  { tag: t.url, color: "var(--blue-dim)" },
  { tag: t.monospace, color: "var(--aqua)", fontFamily: "var(--mono)" },
  { tag: t.quote, color: "var(--gray)" },
  { tag: t.list, color: "var(--yellow)" },
  { tag: t.meta, color: "var(--purple)" },
  { tag: t.comment, color: "var(--gray)" },
  { tag: t.string, color: "var(--green)" },
  { tag: t.keyword, color: "var(--red)" },
  { tag: t.number, color: "var(--purple)" },
  { tag: t.variableName, color: "var(--blue)" },
  { tag: t.function(t.variableName), color: "var(--aqua)" },
  { tag: t.typeName, color: "var(--yellow)" },
  { tag: t.operator, color: "var(--orange)" },
  { tag: t.processingInstruction, color: "var(--gray)" },
]);

export interface CodeMirrorEditorProps {
  content: Accessor<string>;
  onInput: (value: string) => void;
  enableMarkdown: boolean;
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  let containerRef!: HTMLDivElement;
  let view: EditorView | undefined;
  const languageCompartment = new Compartment();

  onMount(() => {
    const languageExtension = props.enableMarkdown
      ? markdown({ base: markdownLanguage, codeLanguages: languages })
      : [];

    view = new EditorView({
      state: EditorState.create({
        doc: props.content(),
        extensions: [
          basicSetup,
          gruvboxTheme,
          syntaxHighlighting(gruvboxHighlighting),
          languageCompartment.of(languageExtension),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              props.onInput(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef,
    });
  });

  // Sync external content changes (file switching, LLM writes, etc.)
  createEffect(() => {
    const newContent = props.content();
    if (view && view.state.doc.toString() !== newContent) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent,
        },
      });
    }
  });

  onCleanup(() => view?.destroy());

  return (
    <div
      ref={containerRef}
      id="CODEMIRROR_EDITOR"
    />
  );
}
