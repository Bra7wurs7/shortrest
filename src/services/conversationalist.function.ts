type RoleType = "System" | "User" | "Assistant";

interface ConversationEntry {
  role: RoleType;
  content: string;
}

function parseConversationsFromMarkdown(markdown: string): ConversationEntry[] {
  const conversationRegEx =
    /^####\s*(System|User|Assistant)\n((?:> [^\n]+\n*)+)/gms; // Multiline, global and sticky

  let result: ConversationEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = conversationRegEx.exec(markdown))) {
    if (match && match[1] !== undefined && match[2] !== undefined) {
      // Remove the '> ' from the start of each line in quotes block
      const contentLines = match[2]
        .trim()
        .split("\n")
        .map((line) => line.replace(/^>\s/, ""));

      result.push({
        role: match[1] as RoleType,
        content: contentLines.join("\n"),
      });
    }
  }

  return result;
}
