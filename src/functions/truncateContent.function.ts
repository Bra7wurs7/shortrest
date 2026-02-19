export type TruncateUnit = "words" | "sentences" | "paragraphs" | "all";

/**
 * Truncates text to the last N units from the end.
 * Returns the full text when unit is "all" or length is 0.
 */
export function truncateContent(
  text: string,
  length: number,
  unit: TruncateUnit,
): string {
  if (length === 0 || unit === "all") return text;

  switch (unit) {
    case "words": {
      const words = text.split(/\s+/);
      return words.slice(-length).join(" ");
    }
    case "sentences": {
      const sentences = text.split(/[.!?]\s+/);
      return sentences.slice(-length).join(". ");
    }
    case "paragraphs": {
      const paragraphs = text.split(/\n\n/);
      return paragraphs.slice(-length).join("\n\n");
    }
  }
}
