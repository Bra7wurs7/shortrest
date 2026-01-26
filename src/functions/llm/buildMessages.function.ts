import { Message } from "ollama";
import { BasicFile } from "../../types/basicFile.interface";

export interface MessageBuildConfig {
  systemPrompt: string;
  userPrompt: string;
  fileContent: string;
  modelThoughts: string;
  rollingSummary: string;
  tagFileContents: BasicFile[];
  referencedFileContents: BasicFile[];
  disabledTags: string[];
  disabledFiles: string[];
  disabledAllTags: boolean;
  disabledAllFiles: boolean;
  disabledSystemPrompt: boolean;
  disabledRollingSummary: boolean;
  disabledFileContext: boolean;
  disabledThoughts: boolean;
}

/**
 * Builds the message array for an Ollama chat request.
 * Assembles system prompts, file context, thoughts, and user prompt
 * while respecting disabled toggles.
 */
export function buildMessages(config: MessageBuildConfig): Message[] {
  const messages: Message[] = [];

  // Add tag file contents as system messages
  if (config.tagFileContents.length > 0 && !config.disabledAllTags) {
    const enabledTagContents = config.tagFileContents
      .filter((tfc) => !config.disabledTags.includes(tfc.name))
      .map((tfc) => tfc.content)
      .join("\n");
    if (enabledTagContents) {
      messages.push({ role: "system", content: enabledTagContents });
    }
  }

  // Add referenced file contents as system messages
  if (config.referencedFileContents.length > 0 && !config.disabledAllFiles) {
    const enabledFileContents = config.referencedFileContents
      .filter((fc) => !config.disabledFiles.includes(fc.name))
      .map((fc) => fc.content)
      .join("\n");
    if (enabledFileContents) {
      messages.push({ role: "system", content: enabledFileContents });
    }
  }

  // Add system prompt
  if (config.systemPrompt && !config.disabledSystemPrompt) {
    messages.push({ role: "system", content: config.systemPrompt });
  }

  // Add rolling summary (above file context in message order)
  if (config.rollingSummary && !config.disabledRollingSummary) {
    messages.push({
      role: "system",
      content: `Previously in this document:\n${config.rollingSummary}`,
    });
  }

  // Add model thoughts as assistant context
  if (config.modelThoughts && !config.disabledThoughts) {
    messages.push({ role: "assistant", content: config.modelThoughts });
  }

  // Add file content as assistant context
  if (config.fileContent && !config.disabledFileContext) {
    messages.push({ role: "assistant", content: config.fileContent });
  }

  // Add user prompt
  if (config.userPrompt) {
    messages.push({ role: "user", content: config.userPrompt });
  }

  return messages;
}
