import { ParsedFileName } from "../../types/parsedFileName.interface";

/**
 * Extracts file references from prompt text using [fileName] syntax.
 * Only returns file names that exist in the available files list.
 *
 * @param prompt The user prompt text
 * @param availableFiles List of available file names in the directory
 * @returns Array of matched file names
 */
export function parseFileReferences(
  prompt: string,
  availableFiles: ParsedFileName[] | null,
): string[] {
  if (!availableFiles) return [];

  const matches = prompt.match(/\[(.*?)\]/g);
  if (!matches) return [];

  return matches
    .map((m) => m.replace(/^\s*\[|\]\s*$/g, ""))
    .filter((m) => availableFiles.find((fn) => fn.fullName === m));
}
