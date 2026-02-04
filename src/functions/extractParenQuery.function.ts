/**
 * Given a string and cursor position, check if we're inside an unclosed '('
 * that immediately follows a ']'. This detects the pattern: [display text](query|
 * Returns the text between '(' and cursor, or null if not in this pattern.
 */
export function extractParenQuery(
  text: string,
  cursorPos: number,
): string | null {
  const before = text.substring(0, cursorPos);

  // Find the nearest unclosed '('
  let parenDepth = 0;
  let parenStart = -1;

  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === ")") {
      parenDepth++;
    } else if (before[i] === "(") {
      if (parenDepth > 0) {
        parenDepth--;
      } else {
        parenStart = i;
        break;
      }
    }
  }

  if (parenStart === -1) return null;

  // Check if this '(' is immediately preceded by ']'
  if (parenStart === 0 || before[parenStart - 1] !== "]") {
    return null;
  }

  return before.substring(parenStart + 1);
}
