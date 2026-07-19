/**
 * Given a prompt string and cursor position, find the nearest unclosed '['
 * and return the text between it and the cursor. Returns null if not inside
 * an unclosed bracket. Correctly skips already-closed [filename] pairs.
 */
export function extractBracketQuery(
  text: string,
  cursorPos: number,
): string | null {
  const before = text.substring(0, cursorPos);
  let depth = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === "]") {
      depth++;
    } else if (before[i] === "[") {
      if (depth > 0) {
        depth--;
      } else {
        return before.substring(i + 1);
      }
    }
  }
  return null;
}
