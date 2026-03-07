import type { Message, Tool, ToolCall } from '../types';

export interface WSMessage {
  type: 'chat' | 'chat-response' | 'stream-chunk' | 'stream-end' | 'stream-error' | 'ping' | 'pong' | 'connected' | 'error';
  payload?: unknown;
  id?: string;
}

export interface WSChatPayload {
  messages: Message[];
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

export interface WSChatResponsePayload {
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface WSStreamChunkPayload {
  content: string;
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

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private isConnected = false;
  private messageQueue: WSMessage[] = [];
  private onMessageCallback: ((message: WSMessage) => void) | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly heartbeatIntervalMs = 25000;
  private readonly heartbeatTimeoutMs = 10000;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  constructor(url: string = 'ws://localhost:8765') {
    this.url = url;
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.cleanup();
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] 已连接到服务器');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(true);
          }
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            if (message.type === 'pong') {
              this.resetHeartbeatTimeout();
              return;
            }
            console.log('[WS] 收到消息:', message.type);
            if (this.onMessageCallback) {
              this.onMessageCallback(message);
            }
          } catch (error) {
            console.error('[WS] 解析消息失败:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[WS] 连接已关闭, code:', event.code, 'reason:', event.reason);
          this.isConnected = false;
          this.stopHeartbeat();
          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback(false);
          }
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WS] 连接错误:', error);
          this.isConnected = false;
          resolve(false);
        };
      } catch (error) {
        console.error('[WS] 创建连接失败:', error);
        resolve(false);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
      console.log(`[WS] 尝试重连 (${this.reconnectAttempts}), ${delay}ms后重试...`);
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.heartbeatTimeout = setTimeout(() => {
          console.log('[WS] 心跳超时，断开连接');
          this.ws?.close();
        }, this.heartbeatTimeoutMs);
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private cleanup() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.onConnectionChangeCallback = callback;
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.log('[WS] 连接未就绪，消息加入队列');
      this.messageQueue.push(message);
    }
  }

  onMessage(callback: (message: WSMessage) => void) {
    this.onMessageCallback = callback;
  }

  disconnect() {
    this.cleanup();
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

let wsClient: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }
  return wsClient;
}
