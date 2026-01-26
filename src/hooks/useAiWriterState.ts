import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  Setter,
} from "solid-js";
import { TextUnits } from "../types/textUnits.enum";
import { ParsedFileName } from "../types/parsedFileName.interface";
import { BasicFile } from "../types/basicFile.interface";
import { getFileContent } from "../functions/dbFilesInterface.functions";
import { parseFileReferences } from "../functions/llm/parseFileReferences.function";
import { PromptState } from "../types/promptState.interface";

export interface UseAiWriterStateProps {
  displayedFileContent: Accessor<string>;
  displayedFileName: Accessor<string | null>;
  activeDirectoryParsedFileNames: Accessor<ParsedFileName[] | null>;
  activeDirectoryName: Accessor<string | null>;
  promptState: PromptState;
  // Setters for derived data that App.tsx needs for LLM calls
  setReducedFileContent: Setter<string>;
  setReferencedFilesContents: Setter<BasicFile[]>;
  setReferencedTagFileContents: Setter<BasicFile[]>;
}

export interface SectionCollapsedState {
  tags: Accessor<boolean>;
  references: Accessor<boolean>;
  systemPrompt: Accessor<boolean>;
  rollingSummary: Accessor<boolean>;
  fileContext: Accessor<boolean>;
  thoughts: Accessor<boolean>;
  userPrompt: Accessor<boolean>;
}

export interface UseAiWriterStateReturn {
  // Derived data
  allDefinedTags: Accessor<string[][]>;
  referencedFiles: Accessor<string[]>;
  referencedTags: Accessor<string[][]>;
  referencedTagFileContents: Accessor<BasicFile[]>;
  reducedFileContent: Accessor<string>;

  // UI state
  sectionCollapsed: SectionCollapsedState;
  toggleSectionCollapsed: (section: keyof SectionCollapsedState) => void;

  // Actions
  onClickTagToggle: (tuple: string[]) => void;
  onClickFileToggle: (name: string) => void;
}

export function useAiWriterState(
  props: UseAiWriterStateProps,
): UseAiWriterStateReturn {
  const ps = props.promptState;

  // ============================================
  // Section collapsed state
  // ============================================
  const [tagsCollapsed, setTagsCollapsed] = createSignal(false);
  const [referencesCollapsed, setReferencesCollapsed] = createSignal(false);
  const [systemPromptCollapsed, setSystemPromptCollapsed] = createSignal(false);
  const [rollingSummaryCollapsed, setRollingSummaryCollapsed] =
    createSignal(false);
  const [fileContextCollapsed, setFileContextCollapsed] = createSignal(false);
  const [thoughtsCollapsed, setThoughtsCollapsed] = createSignal(false);
  const [userPromptCollapsed, setUserPromptCollapsed] = createSignal(false);

  const sectionCollapsed: SectionCollapsedState = {
    tags: tagsCollapsed,
    references: referencesCollapsed,
    systemPrompt: systemPromptCollapsed,
    rollingSummary: rollingSummaryCollapsed,
    fileContext: fileContextCollapsed,
    thoughts: thoughtsCollapsed,
    userPrompt: userPromptCollapsed,
  };

  function toggleSectionCollapsed(section: keyof SectionCollapsedState) {
    switch (section) {
      case "tags":
        setTagsCollapsed(!tagsCollapsed());
        break;
      case "references":
        setReferencesCollapsed(!referencesCollapsed());
        break;
      case "systemPrompt":
        setSystemPromptCollapsed(!systemPromptCollapsed());
        break;
      case "rollingSummary":
        setRollingSummaryCollapsed(!rollingSummaryCollapsed());
        break;
      case "fileContext":
        setFileContextCollapsed(!fileContextCollapsed());
        break;
      case "thoughts":
        setThoughtsCollapsed(!thoughtsCollapsed());
        break;
      case "userPrompt":
        setUserPromptCollapsed(!userPromptCollapsed());
        break;
    }
  }

  // ============================================
  // Memos for tag/file references
  // ============================================
  const allDefinedTags = createMemo<string[][]>(() => {
    const activeDirParsedFileNames = props.activeDirectoryParsedFileNames();

    if (activeDirParsedFileNames) {
      return (
        activeDirParsedFileNames
          .filter((fn) => !fn.baseName && fn.tags.length > 0)
          .map((fn) => fn.tags) ?? []
      );
    }
    return [];
  });

  const referencedFiles = createMemo<string[]>(() => {
    return parseFileReferences(
      ps.userPrompt(),
      props.activeDirectoryParsedFileNames(),
    );
  });

  // Load referenced file contents when referencedFiles changes
  createEffect(() => {
    const fileNames = referencedFiles();
    const activeDirName = props.activeDirectoryName();

    if (activeDirName && fileNames.length > 0) {
      const fileContentPromises = fileNames.map(async (fileName: string) => {
        return {
          name: fileName,
          content: (await getFileContent(activeDirName, fileName)) ?? "",
        };
      });
      Promise.all(fileContentPromises).then((files) => {
        props.setReferencedFilesContents(files);
      });
    } else {
      props.setReferencedFilesContents([]);
    }
  });

  const referencedTags = createMemo<string[][]>(() => {
    const fileName = props.displayedFileName();
    const prompt = ps.userPrompt();
    return allDefinedTags().filter(
      (tag) =>
        (fileName?.includes(`${tag.join(" ")}`) &&
          fileName !== `${tag.join(" ")}`) ||
        prompt.includes(`${tag.join(" ")}`),
    );
  });

  const [referencedTagFileContents, setReferencedTagFileContents] =
    createSignal<BasicFile[]>([]);

  // Load referenced tag file contents when referencedTags changes
  createEffect(() => {
    const appearingTags = referencedTags();
    const activeDirName = props.activeDirectoryName();
    if (activeDirName !== null && appearingTags.length > 0) {
      const fileContentPromises = appearingTags.map(async (tag: string[]) => {
        const fileName = tag.map((fn) => `${fn}`).join(" ");
        return {
          name: fileName,
          content: (await getFileContent(activeDirName, fileName)) ?? "",
        };
      });
      Promise.all(fileContentPromises).then((files) => {
        setReferencedTagFileContents(files);
        props.setReferencedTagFileContents(files);
      });
    } else {
      setReferencedTagFileContents([]);
      props.setReferencedTagFileContents([]);
    }
  });

  const reducedFileContent = createMemo(() => {
    const wholeFile = props.displayedFileContent();
    let reducedFile = wholeFile;
    const length = ps.reducedFileContentLength();
    const unit = ps.reducedFileContentUnit();

    if (length === 0 || unit === TextUnits.All) {
      return wholeFile;
    }

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
    }

    return reducedFile;
  });

  // Notify parent of reducedFileContent changes
  createEffect(() => {
    props.setReducedFileContent(reducedFileContent());
  });

  // ============================================
  // UI Actions
  // ============================================
  function onClickTagToggle(tuple: string[]) {
    const tag = `${tuple.join(" ")}`;
    const dsbldTags = ps.disabledTags();
    if (dsbldTags.includes(tag)) {
      ps.setDisabledTags(dsbldTags.filter((t) => t !== tag));
    } else {
      ps.setDisabledTags([tag, ...dsbldTags]);
    }
  }

  function onClickFileToggle(name: string) {
    const dsbldFiles = ps.disabledFiles();
    if (dsbldFiles.includes(name)) {
      ps.setDisabledFiles(dsbldFiles.filter((f) => f !== name));
    } else {
      ps.setDisabledFiles([name, ...dsbldFiles]);
    }
  }

  return {
    // Derived data
    allDefinedTags,
    referencedFiles,
    referencedTags,
    referencedTagFileContents,
    reducedFileContent,

    // UI state
    sectionCollapsed,
    toggleSectionCollapsed,

    // Actions
    onClickTagToggle,
    onClickFileToggle,
  };
}
