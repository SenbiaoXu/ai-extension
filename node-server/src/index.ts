import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import type {
  WebSocketMessage,
  ChatPayload,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIStreamResponse,
  OpenAIModelsResponse,
  ChatResponsePayload,
  StreamChunkPayload,
  ExternalRequestPayload,
  ExternalResponsePayload,
  ModelsResponsePayload,
} from './types.js';

const DEFAULT_HTTP_PORT = 11435;
const DEFAULT_WS_PORT = 8765;

export interface ServerOptions {
  httpPort?: number;
  wsPort?: number;
}

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  connectedAt: Date;
}

interface PendingRequest {
  resolve: (value: OpenAIChatCompletionResponse) => void;
  reject: (reason: unknown) => void;
  stream: boolean;
  res?: ServerResponse;
  chunks: Array<{ content: string | null; tool_calls?: Array<{ index: number; id?: string; type?: 'function'; function?: { name?: string; arguments?: string } }> }>;
  model: string;
  startTime: number;
  finished: boolean;
}

export function startServer(options: ServerOptions = {}) {
  const HTTP_PORT = options.httpPort ?? (process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : DEFAULT_HTTP_PORT);
  const WS_PORT = options.wsPort ?? (process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : DEFAULT_WS_PORT);

  const clients: Map<string, ConnectedClient> = new Map();
  const pendingRequests: Map<string, PendingRequest> = new Map();
  const pendingModelsRequests: Map<string, {
    resolve: (value: ModelsResponsePayload) => void;
    reject: (reason: unknown) => void;
  }> = new Map();

  const wss = new WebSocketServer({ port: WS_PORT });

  let isStreamingOutput = false;

  function convertContentToString(content: unknown): string | null {
    if (content === null || content === undefined) {
      return null;
    }
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      const textParts: string[] = [];
      for (const part of content) {
        if (typeof part === 'object' && part !== null && 'type' in part) {
          if (part.type === 'text' && 'text' in part) {
            textParts.push(String(part.text));
          }
        }
      }
      return textParts.join('\n') || null;
    }
    return JSON.stringify(content);
  }

  function generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function generateRequestId(): string {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function getFirstClient(): ConnectedClient | undefined {
    return clients.values().next().value;
  }

  function sendToClient(clientId: string, message: WebSocketMessage) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  function broadcastToAll(message: WebSocketMessage, excludeId?: string) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client, id) => {
      if (id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  function notifyExternalRequest(payload: ExternalRequestPayload) {
    broadcastToAll({
      type: 'external-request',
      payload,
    });
  }

  function notifyExternalResponse(payload: ExternalResponsePayload) {
    broadcastToAll({
      type: 'external-response',
      payload,
    });
  }

  function handleWSMessage(data: RawData, clientId: string) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          sendToClient(clientId, { type: 'pong' });
          break;

        case 'chat-response': {
          const payload = message.payload as ChatResponsePayload;
          const pending = pendingRequests.get(message.id || '');
          
          if (pending && !pending.finished) {
            pending.finished = true;
            if (pending.stream && pending.res) {
              const streamResponse: OpenAIStreamResponse = {
                id: message.id || '',
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: pending.model,
                choices: [{
                  index: 0,
                  delta: { content: payload.content },
                  finish_reason: 'stop',
                }],
              };
              pending.res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
              pending.res.write('data: [DONE]\n\n');
              pending.res.end();
              notifyExternalResponse({
                requestId: message.id || '',
                status: 'success',
                content: payload.content,
                duration: Date.now() - pending.startTime,
                timestamp: Date.now(),
              });
            } else {
              const response: OpenAIChatCompletionResponse = {
                id: message.id || '',
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: pending.model,
                choices: [{
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: payload.content,
                    tool_calls: payload.tool_calls,
                  },
                  finish_reason: payload.tool_calls ? 'tool_calls' : 'stop',
                }],
              };
              pending.resolve(response);
              notifyExternalResponse({
                requestId: message.id || '',
                status: 'success',
                content: payload.content,
                duration: Date.now() - pending.startTime,
                timestamp: Date.now(),
              });
            }
            pendingRequests.delete(message.id || '');
          } else {
            if (!isStreamingOutput) {
              console.log(payload.content || '');
              console.log('\n');
            }
          }
          break;
        }

        case 'stream-chunk': {
          const payload = message.payload as StreamChunkPayload;
          const pending = pendingRequests.get(message.id || '');
          
          if (pending && !pending.finished && pending.stream && pending.res) {
            const streamResponse: OpenAIStreamResponse = {
              id: message.id || '',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: pending.model,
              choices: [{
                index: 0,
                delta: {
                  content: payload.content,
                  tool_calls: payload.tool_calls,
                },
                finish_reason: null,
              }],
            };
            pending.res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
            pending.chunks.push({ content: payload.content, tool_calls: payload.tool_calls });
          } else {
            isStreamingOutput = true;
            process.stdout.write(payload.content || '');
          }
          break;
        }

        case 'stream-end': {
          const pending = pendingRequests.get(message.id || '');
          
          if (pending && !pending.finished && pending.stream && pending.res) {
            pending.finished = true;
            const streamResponse: OpenAIStreamResponse = {
              id: message.id || '',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: pending.model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop',
              }],
            };
            pending.res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
            pending.res.write('data: [DONE]\n\n');
            pending.res.end();
            notifyExternalResponse({
              requestId: message.id || '',
              status: 'success',
              duration: Date.now() - pending.startTime,
              timestamp: Date.now(),
            });
            pendingRequests.delete(message.id || '');
          } else {
            isStreamingOutput = false;
            process.stdout.write('\n\n');
          }
          break;
        }

        case 'stream-error': {
          const payload = message.payload as { message: string };
          const pending = pendingRequests.get(message.id || '');
          
          if (pending && !pending.finished) {
            pending.finished = true;
            if (pending.stream && pending.res) {
              pending.res.write(`data: ${JSON.stringify({ error: { message: payload.message, type: 'internal_error' } })}\n\n`);
              pending.res.end();
            } else {
              pending.reject(new Error(payload.message));
            }
            notifyExternalResponse({
              requestId: message.id || '',
              status: 'error',
              error: payload.message,
              duration: Date.now() - pending.startTime,
              timestamp: Date.now(),
            });
            pendingRequests.delete(message.id || '');
          } else {
            console.error('❌ 流式响应错误:', payload.message);
          }
          break;
        }

        case 'chat':
          console.log(`[${new Date().toISOString()}] 收到消息 [${clientId}]:`, message.type);
          console.log('📝 聊天请求:', JSON.stringify((message.payload as ChatPayload)?.messages, null, 2));
          console.log('⏳ 等待浏览器扩展处理并返回结果...\n');
          broadcastToAll(message, clientId);
          break;

        case 'models-response': {
          const payload = message.payload as ModelsResponsePayload;
          const pending = pendingModelsRequests.get(message.id || '');
          if (pending) {
            if (payload.error) {
              pending.reject(new Error(payload.error));
            } else {
              pending.resolve(payload);
            }
            pendingModelsRequests.delete(message.id || '');
          }
          break;
        }

        default:
          console.log(`[${new Date().toISOString()}] 收到消息 [${clientId}]:`, message.type);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  wss.on('connection', (ws) => {
    const clientId = generateClientId();
    clients.set(clientId, {
      ws,
      id: clientId,
      connectedAt: new Date(),
    });

    console.log(`\n🔗 新客户端连接: ${clientId}`);
    console.log(`📊 当前连接数: ${clients.size}`);

    ws.send(JSON.stringify({
      type: 'connected',
      payload: { id: clientId },
    }));

    ws.on('message', (data) => handleWSMessage(data, clientId));

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`\n🔌 客户端断开: ${clientId}`);
      console.log(`📊 当前连接数: ${clients.size}`);
    });

    ws.on('error', (error) => {
      console.error(`❌ 客户端错误 [${clientId}]:`, error.message);
      clients.delete(clientId);
    });
  });

  wss.on('error', (error) => {
    console.error('❌ WebSocket服务器错误:', error);
  });

  async function handleOpenAIRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/v1/models' && method === 'GET') {
      const client = getFirstClient();
      
      if (!client) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            message: 'No browser extension connected. Please ensure the extension is running and connected.',
            type: 'service_unavailable',
          },
        }));
        return;
      }

      const requestId = generateRequestId();
      
      const modelsPromise = new Promise<ModelsResponsePayload>((resolve, reject) => {
        pendingModelsRequests.set(requestId, { resolve, reject });
        
        setTimeout(() => {
          if (pendingModelsRequests.has(requestId)) {
            pendingModelsRequests.delete(requestId);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });

      sendToClient(client.id, {
        type: 'fetch-models',
        id: requestId,
      });

      try {
        const response = await modelsPromise;
        const modelsResponse: OpenAIModelsResponse = {
          object: 'list',
          data: response.models,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(modelsResponse));
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : 'Failed to fetch models',
            type: 'internal_error',
          },
        }));
      }
      return;
    }

    if (url === '/v1/chat/completions' && method === 'POST') {
      const client = getFirstClient();
      
      if (!client) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            message: 'No browser extension connected. Please ensure the extension is running and connected.',
            type: 'service_unavailable',
          },
        }));
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }

      let openaiRequest: OpenAIChatCompletionRequest;
      try {
        openaiRequest = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            message: 'Invalid JSON body',
            type: 'invalid_request_error',
          },
        }));
        return;
      }

      const requestId = generateRequestId();
      const { stream = false, tools, tool_choice } = openaiRequest;

      const convertedMessages = openaiRequest.messages.map(m => ({
        ...m,
        content: convertContentToString(m.content),
      }));

      const wsPayload: ChatPayload = {
        messages: convertedMessages,
        config: {
          model: openaiRequest.model,
          temperature: openaiRequest.temperature,
          maxTokens: openaiRequest.max_tokens,
        },
        tools,
        tool_choice,
        stream,
      };

      console.log(`\n📥 [${new Date().toISOString()}] 收到OpenAI请求`);
      console.log(`   请求ID: ${requestId}`);
      console.log(`   模型: ${openaiRequest.model}`);
      console.log(`   流式: ${stream}`);
      console.log(`   消息数: ${openaiRequest.messages.length}`);
      if (tools) {
        console.log(`   工具数: ${tools.length}`);
      }

      notifyExternalRequest({
        requestId,
        model: openaiRequest.model,
        messages: openaiRequest.messages.map(m => ({ role: m.role, content: m.content })),
        stream,
        timestamp: Date.now(),
      });

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        pendingRequests.set(requestId, {
          resolve: () => {},
          reject: () => {},
          stream: true,
          res,
          chunks: [],
          model: openaiRequest.model,
          startTime: Date.now(),
          finished: false,
        });

        sendToClient(client.id, {
          type: 'chat',
          id: requestId,
          payload: wsPayload,
        });

        req.on('close', () => {
          const pending = pendingRequests.get(requestId);
          if (pending) {
            pending.finished = true;
            notifyExternalResponse({
              requestId,
              status: 'success',
              duration: Date.now() - pending.startTime,
              timestamp: Date.now(),
            });
          }
          pendingRequests.delete(requestId);
        });
      } else {
        const pendingRequest: PendingRequest = {
          resolve: () => {},
          reject: () => {},
          stream: false,
          chunks: [],
          model: openaiRequest.model,
          startTime: Date.now(),
          finished: false,
        };
        
        pendingRequests.set(requestId, pendingRequest);

        const timeout = setTimeout(() => {
          if (!pendingRequest.finished) {
            pendingRequest.finished = true;
            pendingRequests.delete(requestId);
            notifyExternalResponse({
              requestId,
              status: 'timeout',
              error: 'Request timeout',
              duration: Date.now() - pendingRequest.startTime,
              timestamp: Date.now(),
            });
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: {
                message: 'Request timeout',
                type: 'timeout_error',
              },
            }));
          }
        }, 120000);

        new Promise<OpenAIChatCompletionResponse>((resolve, reject) => {
          pendingRequest.resolve = resolve;
          pendingRequest.reject = reject;

          sendToClient(client.id, {
            type: 'chat',
            id: requestId,
            payload: wsPayload,
          });
        })
          .then((response) => {
            clearTimeout(timeout);
            if (!pendingRequest.finished) {
              pendingRequest.finished = true;
              pendingRequests.delete(requestId);
              const duration = Date.now() - pendingRequest.startTime;
              console.log(`\n📤 [${new Date().toISOString()}] 响应已发送`);
              console.log(`   请求ID: ${requestId}`);
              console.log(`   耗时: ${duration}ms`);
              notifyExternalResponse({
                requestId,
                status: 'success',
                content: response.choices[0]?.message?.content || null,
                duration,
                timestamp: Date.now(),
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
            }
          })
          .catch((error) => {
            clearTimeout(timeout);
            if (!pendingRequest.finished) {
              pendingRequest.finished = true;
              pendingRequests.delete(requestId);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              notifyExternalResponse({
                requestId,
                status: 'error',
                error: errorMessage,
                duration: Date.now() - pendingRequest.startTime,
                timestamp: Date.now(),
              });
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: {
                  message: errorMessage,
                  type: 'internal_error',
                },
              }));
            }
          });
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message: `Not found: ${url}`,
        type: 'not_found',
      },
    }));
  }

  const httpServer = createServer(handleOpenAIRequest);

  httpServer.listen(HTTP_PORT, () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        鸿蒙AI助手 - 大模型接口中转站                      ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  HTTP API端口: http://localhost:${HTTP_PORT.toString().padEnd(26)}║`);
    console.log(`║  WebSocket端口: ${WS_PORT.toString().padEnd(31)}║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  OpenAI兼容接口:                                          ║');
    console.log(`║    POST http://localhost:${HTTP_PORT}/v1/chat/completions    ║`);
    console.log(`║    GET  http://localhost:${HTTP_PORT}/v1/models               ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  等待浏览器扩展连接...                                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  });

  function gracefulShutdown(signal: string) {
    console.log(`\n\n👋 收到 ${signal} 信号，正在关闭服务器...`);
    
    const forceExitTimeout = setTimeout(() => {
      console.log('⚠️ 强制退出');
      process.exit(1);
    }, 3000);

    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1001, 'Server shutting down');
      }
    });
    clients.clear();

    wss.close(() => {
      console.log('✅ WebSocket 服务器已关闭');
      httpServer.close(() => {
        clearTimeout(forceExitTimeout);
        console.log('✅ HTTP 服务器已关闭');
        process.exit(0);
      });
    });
  }

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
