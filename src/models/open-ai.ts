export interface OpenAiChatBody {
  /*
  https://platform.openai.com/docs/api-reference/chat
  */

  model: string;
  messages: { role: OpenAiMessageRole; content: string }[];

  max_tokens?: number | null;
  temperature?: number | null;
  top_p?: number | null;
  stream?: boolean | null;

  frequency_penalty?: number | null;
  logit_bias?: Record<string, any> | null;
  logprobs?: boolean | null;
  top_logprobs?: number | null;
  n?: number | null;
  presence_penalty?: number | null;
  response_format?: Record<string, any> | null;
  seed?: number | null;
  service_tier?: string | null;
  stop?: string | string[] | null;
  stream_options?: boolean;
  tools?: string[];
  tool_choice?: string | Record<string, any>;
  parallel_tool_calls?: boolean;
  user?: string;
}

export interface OpenAiChatResponse {
  id: string;
  choices: {
    finish_reason: OpenAiFinishReason;
    index: number;
    message: {
      content: string | null;
      tool_calls: {
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }[];
    };
    logprobs: {
      content:
        | {
            token: string;
            logprob: number;
            bytes: Uint8Array | null;
            top_logprobs: {
              token: string;
              logprob: number;
              bytes: Uint8Array | null;
            };
          }[]
        | null;
    } | null;
  }[];
  created: EpochTimeStamp;
  model: string;
  service_tier: string | null;
  system_fingerprint: string;
  object: "chat.completion";
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

export type OpenAiMessageRole = "system" | "user" | "assistant";

export type OpenAiFinishReason =
  | "stop"
  | "length"
  | "content_filter"
  | "tool_calls";
