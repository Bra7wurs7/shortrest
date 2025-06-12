export const RIGHTSIDEBARTOOLS: Record<
  string,
  {
    name: string;
    inputSchema: { type: string; properties: Record<string, any> };
    outputSchema: { type: string; properties: Record<string, any> };
    description: string;
  }
> = {
  readFile: {
    name: "Read File",
    inputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name of the file to read",
        },
        readType: {
          type: "string",
          description: "Whether to read 'all', 'paragraphs' or 'words'",
        },
        readAmount: {
          type: "number",
          description: "The maximum number of text units to read from the file",
        },
        readEnd: {
          type: "boolean",
          description:
            "whether to read the end of the file instead of its start",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "the first/last {readAmount} words or paragraphs of the text",
        },
      },
    },
    description: "Extract (the last x) words/paragraphs from a given text file",
  },
  constructMessage: {
    name: "Construct Message",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content of the message",
        },
        format: {
          type: "string",
          description: "How the content of the message should be presented",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "object",
          description: "The constructed message",
        },
      },
    },
    description: "Construct a message object that can be used by a Chat API",
  },
  streamChatApi: {
    name: "Stream Chat API",
    inputSchema: {
      type: "object",
      properties: {
        apiName: {
          type: "string",
          description: "Name of the registered API to use",
        },
        apiConfiguration: {
          type: "object",
          description: "LLM Chat API configuration",
        },
        messages: {
          type: "array",
          description: "Messages",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        output: {
          type: "object",
          description: "Stream of answer message fragments",
        },
      },
    },
    description:
      "Send the provided messages to a Chat API and stream the result",
  },
  writeStreamToFile: {
    name: "Write File",
    inputSchema: {
      type: "object",
      properties: {
        apiName: {
          type: "fileName",
          description: "Name of the file to write to",
        },
        apiConfiguration: {
          type: "object",
          description: "Stream of message fragments",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {},
    },
    description:
      "Adds tokens from a stream of strings to the end of a given text file ",
  },
};
