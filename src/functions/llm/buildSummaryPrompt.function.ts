import { SummaryStyle } from "../../types/summaryStyle.enum";
import { TextUnits } from "../../types/textUnits.enum";

export interface SummaryPromptConfig {
  fileContent: string;
  existingSummary: string;
  summaryStyle: SummaryStyle;
  maxLength?: number;
  maxLengthUnit?: TextUnits;
  mode: "generate" | "extend";
}

/**
 * Builds a prompt for generating or extending a rolling summary.
 */
export function buildSummaryPrompt(config: SummaryPromptConfig): string {
  const styleInstructions = getStyleInstructions(config.summaryStyle);
  const lengthInstruction = getLengthInstruction(
    config.maxLength,
    config.maxLengthUnit,
  );

  if (config.mode === "generate") {
    return `Summarize the following text. ${styleInstructions} ${lengthInstruction}

Text to summarize:
${config.fileContent}

Summary:`;
  } else {
    // extend mode
    return `You have an existing summary of earlier content, and new content has been added. Update the summary to incorporate the new content while keeping it concise. ${styleInstructions} ${lengthInstruction}

Existing summary:
${config.existingSummary}

New content to incorporate:
${config.fileContent}

Updated summary:`;
  }
}

function getStyleInstructions(style: SummaryStyle): string {
  switch (style) {
    case SummaryStyle.Narrative:
      return "Write the summary as flowing prose that captures the narrative arc and key developments.";
    case SummaryStyle.Bullets:
      return "Write the summary as a bullet-point list of key events and information.";
    case SummaryStyle.KeyEvents:
      return "Focus on the most important events and turning points, listing them chronologically.";
    case SummaryStyle.CharacterFocused:
      return "Focus on character development, relationships, and motivations.";
    default:
      return "";
  }
}

function getLengthInstruction(length?: number, unit?: TextUnits): string {
  // Always return empty string since we've removed length limitations
  return "";
}
