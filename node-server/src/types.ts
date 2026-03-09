export interface WebSocketMessage {
  type: 'chat' | 'chat-response' | 'stream-chunk' | 'stream-end' | 'stream-error' | 'ping' | 'pong' | 'connected' | 'error' | 'external-request' | 'external-response' | 'fetch-models' | 'models-response';
  payload?: unknown;
  id?: string;
}

export interface ChatPayload {
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
  }>;
  config?: {
    endpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  stream?: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatResponsePayload {
  content: string | null;
  id?: string;
  tool_calls?: ToolCall[];
}

export interface StreamChunkPayload {
  content: string;
  id?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface ErrorPayload {
  message: string;
  id?: string;
}

export interface ExternalRequestPayload {
  requestId: string;
  model: string;
  messages: Array<{
    role: string;
    content: string | null;
  }>;
  stream: boolean;
  timestamp: number;
}

export interface ExternalResponsePayload {
  requestId: string;
  status: 'success' | 'error' | 'timeout';
  content?: string | null;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenAIChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | null;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamDelta {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: 'stop' | 'tool_calls' | 'length' | null;
}

export interface OpenAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
}

export interface OpenAIModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

export interface ModelsResponsePayload {
  models: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
  error?: string;
}
