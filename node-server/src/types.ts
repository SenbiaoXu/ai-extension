export interface WebSocketMessage {
  type: 'chat' | 'chat-response' | 'stream-chunk' | 'stream-end' | 'stream-error' | 'ping' | 'pong' | 'connected' | 'error';
  payload?: unknown;
  id?: string;
}

export interface ChatPayload {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  config?: {
    endpoint?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ChatResponsePayload {
  content: string;
  id?: string;
}

export interface StreamChunkPayload {
  content: string;
  id?: string;
}

export interface ErrorPayload {
  message: string;
  id?: string;
}
