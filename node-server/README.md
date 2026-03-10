# @hh-agent/local-model

鸿蒙AI助手本地服务器 - 提供 OpenAI 兼容的 HTTP API 接口，通过 WebSocket 与浏览器扩展通信，调用鸿蒙端侧 AI 模型。

## 功能

- **HTTP API**: 提供 OpenAI 兼容的 REST API 接口
- **WebSocket**: 与浏览器扩展保持长连接
- **流式响应**: 支持 Server-Sent Events (SSE) 流式输出
- **工具调用**: 支持函数调用 (Function Calling)

## 架构

```
外部应用 → HTTP API (OpenAI兼容) → Node Server → WebSocket → 浏览器扩展 → 鸿蒙AI模型
                                        ↑                                           ↓
                                      HTTP响应 ←──────────────────────────────── 推理结果
```

## 安装

```bash
# 全局安装
npm install -g @hh-agent/local-model

# 或作为项目依赖
npm install @hh-agent/local-model
```

## 使用

### 命令行启动

```bash
# 全局安装后直接运行
hh-local-start

# 或通过 npx 运行
npx @hh-agent/local-model hh-local-start
```

### 编程方式使用

```javascript
import { startServer } from '@hh-agent/local-model';

// 使用默认端口启动
startServer();

// 或指定端口
startServer({
  httpPort: 11435,
  wsPort: 8765
});
```

### 环境变量配置

- `HTTP_PORT`: HTTP API 端口，默认 `11435`
- `WS_PORT`: WebSocket 端口，默认 `8765`

## OpenAI 兼容接口

### 获取模型列表

```bash
curl http://localhost:11435/v1/models
```

响应：
```json
{
  "object": "list",
  "data": [
    {
      "id": "harmonyos-default",
      "object": "model",
      "created": 1234567890,
      "owned_by": "harmonyos"
    }
  ]
}
```

### 对话补全 (非流式)

```bash
curl http://localhost:11435/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "harmonyos-default",
    "messages": [
      { "role": "user", "content": "你好" }
    ]
  }'
```

响应：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "harmonyos-default",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是鸿蒙AI助手..."
      },
      "finish_reason": "stop"
    }
  ]
}
```

### 对话补全 (流式)

```bash
curl http://localhost:11435/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "harmonyos-default",
    "messages": [
      { "role": "user", "content": "你好" }
    ],
    "stream": true
  }'
```

响应 (SSE 格式)：
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"harmonyos-default","choices":[{"index":0,"delta":{"content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"harmonyos-default","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"harmonyos-default","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### 工具调用 (Function Calling)

```bash
curl http://localhost:11435/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "harmonyos-default",
    "messages": [
      { "role": "user", "content": "北京今天天气怎么样？" }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "获取指定城市的天气信息",
          "parameters": {
            "type": "object",
            "properties": {
              "city": {
                "type": "string",
                "description": "城市名称"
              }
            },
            "required": ["city"]
          }
        }
      }
    ]
  }'
```

响应：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "harmonyos-default",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_xxx",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"city\":\"北京\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

## 使用 OpenAI SDK

可以使用任何支持 OpenAI API 的 SDK 调用：

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:11435/v1',
  apiKey: 'dummy', // 可以是任意值
});

const response = await client.chat.completions.create({
  model: 'harmonyos-default',
  messages: [{ role: 'user', content: '你好' }],
});

console.log(response.choices[0].message.content);
```

## 使用流程

1. 启动 node-server
2. 安装并启动浏览器扩展（扩展会自动连接 WebSocket）
3. 外部应用通过 HTTP API 发送请求
4. node-server 将请求转发给浏览器扩展
5. 浏览器扩展调用鸿蒙端侧 AI 模型
6. 响应结果返回给外部应用

## 错误处理

### 503 Service Unavailable
浏览器扩展未连接时返回：
```json
{
  "error": {
    "message": "No browser extension connected. Please ensure the extension is running and connected.",
    "type": "service_unavailable"
  }
}
```

### 504 Gateway Timeout
请求超时时返回（默认 120 秒）：
```json
{
  "error": {
    "message": "Request timeout",
    "type": "timeout_error"
  }
}
```
