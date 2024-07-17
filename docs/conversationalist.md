What's a noob-friendly and easy to parse format to store llm conversations (strings of text that are each assigned a role 'system', 'user' or 'assistant') in a markdown document?

1. Using Headings: Use level 2 headings to denote the roles ('system', 'user', 'assistant'). The heading should be wrapped in '#' symbols, followed by a space and the text (e.g., `## User`). This will make it easier to parse through your document since you can use table of contents or quick searches in many editors to find these roles.

2. Using Quotes: After declaring the role heading, begin a new paragraph with the conversation string enclosed within '>'. Markdown allows for simple quotations using '>' at the start of the line, making it easy to differentiate between the roles and the conversations.

3. Separation with Horizontal Lines: To further clarify each conversation role and its context, you can use three or more asterisks (\*\*\*), hyphens (---), or underscores (\_ \_ \_) on new lines between different conversational instances. This makes your document easily readable and segmented for parsing.

An example would look like this:

```
## System
> System initializes conversation.

----

## User
> What's the weather like today?

----

## Assistant
> According to my last update, it's sunny and 25 degrees Celsius in London right now.
```

Write a TypeScript function that finds such a conversation in a markdown formatted string and parses it to {role: RoleType, content: string}[]
Here is the solution for your problem in Typescript:

This solution assumes that each conversation entry starts with a level-2 heading followed by an indented quote block.

```typescript
enum RoleType {
  System = "System",
  User = "User",
  Assistant = "Assistant",
}

interface ConversationEntry {
  role: RoleType;
  content: string;
}

export const parseConversationsFromMarkdown = (
  markdown: string,
): ConversationEntry[] => {
  const conversationRegEx =
    /^##\s*(System|User|Assistant)\n> (.*?)(?:(?=\n\n## )|\n*$)/gms; // multiline, global and sticky

  let result: ConversationEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = conversationRegEx.exec(markdown))) {
    if (match && match[1] !== undefined && match[2] !== undefined) {
      result.push({ role: RoleType[match[1]], content: match[2].trim() });
    }
  }

  return result;
};
```

The function `parseConversationsFromMarkdown(markdown)` receives a markdown formatted string and returns an array of `{role, content}` objects. The role is determined by the level-2 heading (either System, User or Assistant). Each conversation's textual content is extracted from its subsequent quote block.
The `conversationRegEx` regular expression performs this parsing: it matches a level-2 heading followed by an indented quote block that continues until it encounters another level-2 header or the end of string. The captured groups are then converted into the appropriate role type and text content object, which is added to our results array.
