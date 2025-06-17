export const RIGHTSIDEBARTOOLS: Record<
  string,
  {
    name: string;
    inputSchema: {
      type: string;
      properties: Record<
        string,
        { type: string; description: string; required: boolean }
      >;
    };
    outputSchema: {
      type: string;
      properties: Record<
        string,
        { type: string; description: string; nullable: boolean }
      >;
    };
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
          required: false,
        },
        readType: {
          type: "string",
          description: "Whether to read 'all', 'paragraphs' or 'words'",
          required: false,
        },
        readAmount: {
          type: "number",
          description: "The maximum number of text units to read from the file",
          required: false,
        },
        readEnd: {
          type: "boolean",
          description:
            "whether to read the end of the file instead of its start",
          required: false,
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
          nullable: false,
        },
      },
    },
    description: "Extract (the last x) words/paragraphs from a given text file",
  },
  constructMessage: {
    name: "Message",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content of the message",
          required: false,
        },
        format: {
          type: "string",
          description: "How the content of the message should be presented",
          required: false,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "object",
          description: "The constructed message",
          nullable: false,
        },
      },
    },
    description: "Construct a message object that can be used by a Chat API",
  },
  streamChatApi: {
    name: "AI Chat",
    inputSchema: {
      type: "object",
      properties: {
        apiName: {
          type: "string",
          description: "Name of the registered API to use",
          required: false,
        },
        apiConfiguration: {
          type: "object",
          description: "LLM Chat API configuration",
          required: false,
        },
        messages: {
          type: "array",
          description: "Messages",
          required: false,
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        output: {
          type: "object",
          description: "Stream of answer message fragments",
          nullable: false,
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
          required: false,
        },
        apiConfiguration: {
          type: "object",
          description: "Stream of message fragments",
          required: false,
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
