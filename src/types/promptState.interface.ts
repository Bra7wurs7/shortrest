import { Accessor, Setter } from "solid-js";
import { AbortableAsyncIterator, ChatResponse } from "ollama";
import { TextUnits } from "./textUnits.enum";
import { SummaryStyle } from "./summaryStyle.enum";

/**
 * All prompt-related state passed explicitly to components.
 * Each signal pair (accessor + setter) is grouped together.
 */
export interface PromptState {
  // Core prompts
  userPrompt: Accessor<string>;
  setUserPrompt: Setter<string>;
  systemPrompt: Accessor<string>;
  setSystemPrompt: Setter<string>;
  modelThoughts: Accessor<string>;
  setModelThoughts: Setter<string>;

  // Rolling summary
  rollingSummary: Accessor<string>;
  setRollingSummary: Setter<string>;
  disabledRollingSummary: Accessor<boolean>;
  setDisabledRollingSummary: Setter<boolean>;
  summaryMaxLength: Accessor<number>;
  setSummaryMaxLength: Setter<number>;
  summaryMaxLengthUnit: Accessor<TextUnits>;
  setSummaryMaxLengthUnit: Setter<TextUnits>;
  summaryStyle: Accessor<SummaryStyle>;
  setSummaryStyle: Setter<SummaryStyle>;
  autoSummarize: Accessor<boolean>;
  setAutoSummarize: Setter<boolean>;

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
