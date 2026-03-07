import {
  onMount,
  onCleanup,
  createEffect,
  type Accessor,
  type Setter,
} from "solid-js";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { xml } from "@codemirror/lang-xml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { keymap } from "@codemirror/view";
import { extractParenQuery } from "../functions/extractParenQuery.function";
import { longestCommonPrefix } from "../functions/longestCommonPrefix.function";

const gruvboxTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--color_background_soft)",
      color: "var(--color_foreground_hard)",
      fontFamily: "var(--sans)",
      fontSize: "inherit",
      flexGrow: "1",
      border: "var(--size_border) var(--style_border) transparent",
    },
    "&:hover": {
      borderColor: "var(--color_border_light)",
    },
    "&.cm-focused": {
      outline: "none",
      borderColor: "var(--color_foreground_soft)",
    },
    ".cm-content": {
      padding: "var(--size_padding_large)",
      caretColor: "var(--color_foreground_hard)",
    },
    ".cm-scroller": {
      overflow: "auto",
      backgroundColor: "var(--color_background_hard)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color_foreground_hard)",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--dark2)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--dark2)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--color_background)",
      color: "var(--dark4)",
      border: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--color_background_soft)",
    },
    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
  },
  { dark: true },
);

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
  language: "md" | "xml" | null;
  inputValue: Accessor<string>;
  setInputValue: Setter<string>;
  filteredClipboardFileNames: Accessor<{ fullName: string }[]>;
  filteredDirectoryFileNames: Accessor<{ fullName: string }[] | null>;
  onSave?: () => void;
}

export function CodeMirrorEditor(props: CodeMirrorEditorProps) {
  let containerRef!: HTMLDivElement;
  let view: EditorView | undefined;
  const languageCompartment = new Compartment();
  let inParenMode = false;
  let isSyncingContent = false;

  // Update inputValue based on cursor position (for ]( pattern)
  const updateParenMode = (docText: string, cursorPos: number) => {
    if (props.language !== "md") {
      if (inParenMode) {
        inParenMode = false;
        props.setInputValue("");
      }
      return;
    }

    const parenQuery = extractParenQuery(docText, cursorPos);
    if (parenQuery !== null) {
      inParenMode = true;
      props.setInputValue(parenQuery);
    } else if (inParenMode) {
      inParenMode = false;
      props.setInputValue("");
    }
  };

  // Get all matching file names based on current filter
  const getFilteredFileNames = (): string[] => {
    const clipboardMatches = props
      .filteredClipboardFileNames()
      .map((f) => f.fullName);
    const dirMatches = (props.filteredDirectoryFileNames() ?? []).map(
      (f) => f.fullName,
    );
    return [...clipboardMatches, ...dirMatches];
  };

  // Handle Tab key for autocomplete
  const handleTabAutocomplete = (): boolean => {
    if (!view || !inParenMode) return false;

    const query = props.inputValue();
    const matches = getFilteredFileNames();
    if (matches.length === 0) return false;

    const completion = longestCommonPrefix(matches);
    if (completion.length <= query.length) return false;

    const cursorPos = view.state.selection.main.head;
    const queryStart = cursorPos - query.length;

    if (matches.length === 1) {
      // Single match: replace query with URL-encoded filename and close the paren
      const fileName = matches[0];
      const encodedFileName = encodeURI(fileName);
      view.dispatch({
        changes: {
          from: queryStart,
          to: cursorPos,
          insert: encodedFileName,
        },
        selection: { anchor: queryStart + encodedFileName.length + 1 },
      });
      inParenMode = false;
      props.setInputValue("");
    } else {
      // Multiple matches: replace query with longest common prefix
      view.dispatch({
        changes: {
          from: queryStart,
          to: cursorPos,
          insert: completion,
        },
        selection: { anchor: queryStart + completion.length },
      });
      props.setInputValue(completion);
    }
    return true;
  };

  // Create keymap for custom key bindings
  const customKeymap = keymap.of([
    {
      key: "Tab",
      run: () => handleTabAutocomplete(),
    },
    {
      key: "Mod-s",
      run: () => {
        if (props.onSave) {
          props.onSave();
          return true;
        }
        return false;
      },
    },
  ]);

  const getLanguageExtension = () => {
    if (props.language === "md") return markdown({ base: markdownLanguage, codeLanguages: languages });
    if (props.language === "xml") return xml();
    return [];
  };

  onMount(() => {
    const languageExtension = getLanguageExtension();

    view = new EditorView({
      state: EditorState.create({
        doc: props.content(),
        extensions: [
          basicSetup,
          gruvboxTheme,
          syntaxHighlighting(gruvboxHighlighting),
          languageCompartment.of(languageExtension),
          EditorView.lineWrapping,
          customKeymap,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !isSyncingContent) {
              props.onInput(update.state.doc.toString());
            }
            // Update paren mode on any selection or document change
            if (update.docChanged || update.selectionSet) {
              const cursorPos = update.state.selection.main.head;
              updateParenMode(update.state.doc.toString(), cursorPos);
            }
          }),
        ],
      }),
      parent: containerRef,
    });
  });

  // Reconfigure language extension when language changes (e.g. file rename)
  createEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension()),
    });
  });

  // Sync external content changes (file switching, LLM writes, etc.)
  // Uses minimal diffing to preserve scroll position, cursor, and selection.
  createEffect(() => {
    const newContent = props.content();
    if (!view) return;
    const oldContent = view.state.doc.toString();
    if (oldContent === newContent) return;

    // Find the first character that differs
    let prefixLen = 0;
    const minLen = Math.min(oldContent.length, newContent.length);
    while (
      prefixLen < minLen &&
      oldContent[prefixLen] === newContent[prefixLen]
    ) {
      prefixLen++;
    }

    // Find the last character that differs (not overlapping with prefix)
    let oldSuffix = oldContent.length;
    let newSuffix = newContent.length;
    while (
      oldSuffix > prefixLen &&
      newSuffix > prefixLen &&
      oldContent[oldSuffix - 1] === newContent[newSuffix - 1]
    ) {
      oldSuffix--;
      newSuffix--;
    }

    isSyncingContent = true;
    view.dispatch({
      changes: {
        from: prefixLen,
        to: oldSuffix,
        insert: newContent.slice(prefixLen, newSuffix),
      },
    });
    isSyncingContent = false;
  });

  onCleanup(() => {
    if (inParenMode) {
      props.setInputValue("");
    }
    view?.destroy();
  });

  return <div ref={containerRef} id="CODEMIRROR_EDITOR" />;
}
