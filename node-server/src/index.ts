import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { WebSocketMessage, ChatPayload } from './types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8765;

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  connectedAt: Date;
}

const clients: Map<string, ConnectedClient> = new Map();

const wss = new WebSocketServer({ port: PORT });

function generateClientId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function broadcastToAll(message: WebSocketMessage, excludeId?: string) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client, id) => {
    if (id !== excludeId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

function sendToClient(clientId: string, message: WebSocketMessage) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

function handleMessage(data: RawData, clientId: string) {
  try {
    const message: WebSocketMessage = JSON.parse(data.toString());

    switch (message.type) {
      case 'ping':
        sendToClient(clientId, { type: 'pong' });
        break;

      case 'chat':
        console.log(`[${new Date().toISOString()}] 收到消息 [${clientId}]:`, message.type);
        console.log('📝 聊天请求:', JSON.stringify((message.payload as ChatPayload)?.messages, null, 2));
        console.log('⏳ 等待浏览器扩展处理并返回结果...\n');
        broadcastToAll(message, clientId);
        break;

      case 'chat-response':
        console.log('✅ 收到聊天响应:');
        break;

      case 'stream-chunk':
        process.stdout.write((message.payload as { content: string })?.content || '');
        break;

      case 'stream-end':
        process.stdout.write('\n\n');
        break;

      case 'stream-error':
        console.error('❌ 流式响应错误:', (message.payload as { message: string })?.message);
        break;

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

  ws.on('message', (data) => handleMessage(data, clientId));

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

console.log('╔════════════════════════════════════════════╗');
console.log('║     鸿蒙AI助手 - WebSocket中转服务器       ║');
console.log('╠════════════════════════════════════════════╣');
console.log(`║  端口: ${PORT.toString().padEnd(34)}║`);
console.log('║  等待浏览器扩展连接...                      ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  if (input) {
    console.log('\n📤 发送测试消息到所有客户端...');
    broadcastToAll({
      type: 'chat',
      payload: {
        messages: [{ role: 'user', content: input }],
      },
    });
  }
});

process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务器...');
  wss.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
