export interface WSMessage {
  type: 'chat' | 'chat-response' | 'stream-chunk' | 'stream-end' | 'stream-error' | 'ping' | 'pong' | 'connected' | 'error';
  payload?: unknown;
  id?: string;
}

export interface WSChatPayload {
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

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private messageQueue: WSMessage[] = [];
  private onMessageCallback: ((message: WSMessage) => void) | null = null;

  constructor(url: string = 'ws://localhost:8765') {
    this.url = url;
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] 已连接到服务器');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            console.log('[WS] 收到消息:', message.type);
            if (this.onMessageCallback) {
              this.onMessageCallback(message);
            }
          } catch (error) {
            console.error('[WS] 解析消息失败:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('[WS] 连接已关闭');
          this.isConnected = false;
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
      console.log(`[WS] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
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
