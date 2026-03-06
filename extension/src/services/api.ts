import type { ApiConfig, ChatCompletionRequest, ChatCompletionResponse, StreamResponse, Message } from '../types';

export class HarmonyOSApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<ApiConfig>) {
    this.config = { ...this.config, ...config };
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async chatCompletion(messages: Message[]): Promise<ChatCompletionResponse> {
    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    };

    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async *streamChatCompletion(messages: Message[]): AsyncGenerator<string, void, unknown> {
    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    };

    const response = await fetch(`${this.config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
        if (!trimmedLine.startsWith('data: ')) continue;

        try {
          const json: StreamResponse = JSON.parse(trimmedLine.slice(6));
          const content = json.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          continue;
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const createApiClient = (config: ApiConfig): HarmonyOSApiClient => {
  return new HarmonyOSApiClient(config);
};
