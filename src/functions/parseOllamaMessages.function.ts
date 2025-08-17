import { Message, ToolCall } from "ollama";

/** @author Sebastian Pöhlmann & Codestral:0898a8b286d5 */
export function parseOllamaMessages(messagesJson: string): Message[] | string {
  let messages;
  try {
    // Try to parse the JSON string
    messages = JSON.parse(messagesJson);
  } catch (error) {
    return `Error parsing JSON: ${error}`;
  }

  if (!Array.isArray(messages)) {
    return "The parsed result is not an array";
  }

  // Check that all elements in the array have the required properties for Message
  if (
    messages.every(
      (message) =>
        "role" in message &&
        "content" in message &&
        (!("thinking" in message) || typeof message.thinking === "string") &&
        (!("images" in message) || Array.isArray(message.images)) &&
        (!("tool_calls" in message) ||
          (Array.isArray(message.tool_calls) &&
            message.tool_calls.every(
              (tc: ToolCall) =>
                "id" in tc &&
                "function" in tc &&
                "name" in tc.function &&
                "arguments" in tc.function,
            ))),
    )
  ) {
    return messages;
  } else {
    return "The array contains elements that are not valid Message objects";
  }
}
