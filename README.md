# AI Extension 项目

连接鸿蒙端侧模型的浏览器扩展与后端服务项目。

## 项目组成

### 📦 extension - 浏览器扩展插件

基于 Chrome Extension Manifest V3 的浏览器扩展，提供侧边栏AI对话助手功能。

**主要功能:**
- 侧边栏对话界面
- OpenAI API 兼容
- 流式响应支持
- 可配置的模型参数
- **WebSocket中转站** - 作为AI推理中转站
- **外部消息查看** - 实时查看外部HTTP请求和响应状态

**快速开始:**
```bash
cd extension
npm install
npm run build
```

然后在 Chrome 浏览器中加载 `dist` 目录。

详细文档: [extension/README.md](extension/README.md)

### 🖥️ node-server - 大模型接口中转站

提供 OpenAI 兼容的 HTTP API 接口，通过 WebSocket 与浏览器扩展通信，调用鸿蒙端侧 AI 模型。

**主要功能:**
- **HTTP API**: OpenAI 兼容的 REST API 接口
- **WebSocket**: 与浏览器扩展保持长连接
- **流式响应**: 支持 Server-Sent Events (SSE)
- **工具调用**: 支持函数调用 (Function Calling)

**快速开始:**
```bash
cd node-server
npm install
npm run dev
```

详细文档: [node-server/README.md](node-server/README.md)

## 架构

```
外部应用 → HTTP API (OpenAI兼容) → Node Server → WebSocket → 浏览器扩展 → 鸿蒙AI模型
                                        ↑                                           ↓
                                      HTTP响应 ←──────────────────────────────── 推理结果
```

## 使用方法

### 1. 启动 node-server

```bash
cd node-server
npm install
npm run dev
```

服务器启动后会监听:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:8765`

### 2. 加载浏览器扩展

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/dist` 目录

扩展会自动连接到 WebSocket 服务器。

### 3. 调用 API

使用 curl 或任何 OpenAI SDK:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "harmonyos-default",
    "messages": [{ "role": "user", "content": "你好" }]
  }'
```

或使用 OpenAI SDK:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'dummy',
});

const response = await client.chat.completions.create({
  model: 'harmonyos-default',
  messages: [{ role: 'user', content: '你好' }],
});

console.log(response.choices[0].message.content);
```

## 技术栈

- TypeScript
- Vite
- Chrome Extension API (Manifest V3)
- WebSocket (ws)
- OpenAI API 兼容格式
