# 项目知识沉淀

本文档记录项目开发过程中积累的经验和知识。

## Chrome Extension 开发

### Manifest V3 注意事项

1. **Service Worker 替代 Background Page**
   - Manifest V3 使用 Service Worker 作为后台脚本
   - Service Worker 是无状态的，不能使用 DOM API
   - 需要在 manifest.json 中声明 `"type": "module"` 支持 ES 模块

2. **Side Panel API**
   - 使用 `chrome.sidePanel` API 实现侧边栏
   - 需要声明 `sidePanel` 权限
   - 通过 `chrome.sidePanel.open()` 或设置 `openPanelOnActionClick` 打开

3. **消息通信**
   - 使用 `chrome.runtime.sendMessage()` 和 `chrome.runtime.onMessage` 进行组件间通信
   - Service Worker 中可以使用 `chrome.runtime.sendMessage()` 向其他组件发送消息

### WebSocket 在 Service Worker 中

1. **WebSocket 支持**
   - Service Worker 支持 WebSocket API
   - 可以在后台保持长连接

2. **连接管理**
   - 需要处理断线重连逻辑
   - 消息队列用于连接断开时缓存消息

3. **Service Worker 生命周期问题**
   - Service Worker 在空闲约30秒到几分钟后会被 Chrome 自动终止
   - 当 Service Worker 被终止时，WebSocket 连接也会被强制断开
   - **解决方案**: 实现心跳机制（每25秒发送ping），保持连接活跃
   - 重连策略应使用指数退避，避免频繁重连消耗资源

### Vite 构建浏览器扩展

1. **路径配置**
   - 设置 `base: './'` 使用相对路径
   - HTML 文件需要正确处理子目录中的路径引用
   - 可以在 `closeBundle` 钩子中修正路径

2. **多入口配置**
   - 在 `rollupOptions.input` 中配置多个入口
   - HTML 和 TypeScript 文件都可以作为入口

3. **复制静态资源**
   - 使用自定义插件在 `closeBundle` 钩子中复制文件
   - manifest.json 和图标需要手动复制到 dist 目录

## TypeScript 类型问题

### DOM 元素类型断言

```typescript
// 错误: HTMLElement 缺少特定元素属性
const btn = document.getElementById('btn')!;

// 正确: 使用类型断言
const btn = document.getElementById('btn') as HTMLButtonElement;
```

### 导入路径问题

在 Vite 项目中，导入路径需要正确设置：
- 使用相对路径: `import { foo } from '../services/api'`
- 或配置别名: `import { foo } from '@/services/api'`

### 流式响应中的工具调用类型

OpenAI 流式响应中，`tool_calls` 的结构与完整响应不同：
- 流式响应中 `tool_calls` 包含 `index` 字段用于标识
- 需要使用 Map 按 index 累积工具调用参数
- 类型定义需要区分完整 `ToolCall` 和流式 `delta` 中的部分类型

## WebSocket 中转架构

### 设计模式

浏览器扩展无法作为服务器监听端口，因此采用反向连接模式：
1. 本地 Node.js 服务器监听 WebSocket 端口
2. 浏览器扩展启动后主动连接服务器
3. 外部客户端通过服务器转发消息给扩展

### 消息格式

统一使用 JSON 格式：
```json
{
  "type": "chat | chat-response | stream-chunk | stream-end | error",
  "payload": { ... },
  "id": "optional-message-id"
}
```

## OpenAI API 兼容实现

### HTTP API 设计

实现 OpenAI 兼容接口时需要：
1. **CORS 支持**: 添加 `Access-Control-Allow-*` 头
2. **错误格式**: 使用 OpenAI 标准错误格式 `{ error: { message, type } }`
3. **请求映射**: 将 OpenAI 请求参数映射到内部格式

### 流式响应 (SSE)

Server-Sent Events 格式要求：
- Content-Type: `text/event-stream`
- 每条消息格式: `data: {JSON}\n\n`
- 结束标志: `data: [DONE]\n\n`

### 请求-响应关联

使用唯一 ID 关联 HTTP 请求和 WebSocket 响应：
1. 生成唯一 `requestId`
2. 存储到 `pendingRequests` Map
3. WebSocket 响应携带相同 ID
4. 根据 ID 找到对应的 HTTP 响应对象

## 常见问题解决

### PowerShell 命令语法

**问题**: PowerShell 不支持 `&&` 语法连接多个命令

**解决**: 使用 `;` 分隔符或分开执行命令：
```powershell
# 错误写法
cd extension && npm run build

# 正确写法
cd extension; npm run build

# 或使用 Set-Location
Set-Location extension; npm run build
```

### 构建后路径错误

**问题**: HTML 文件中的 JS/CSS 引用路径不正确

**解决**: 在 Vite 插件的 `closeBundle` 钩子中修正路径：
```javascript
content = content.replace(/\.\.\/\.\.\/js\//g, '../js/');
```

### Service Worker 消息通信

**问题**: Service Worker 无法直接与侧边栏通信

**解决**: 使用 `chrome.runtime.sendMessage()` 广播消息，所有监听器都会收到

### WebSocket 连接时机

**问题**: 扩展启动时服务器可能未就绪

**解决**: 实现自动重连机制，消息队列缓存未发送的消息

### Message.content 可能为 null

**问题**: OpenAI API 中 `message.content` 可能为 `null`（如工具调用时）

**解决**: 使用空值检查或可选链：
```typescript
if (firstUserMessage) {
  conversation.title = firstUserMessage.slice(0, 30);
}
```

## Node.js 服务器开发

### 优雅关闭 (Graceful Shutdown)

**问题**: 服务器退出时卡在"正在关闭服务器"，无法正常退出

**原因**:
- `wss.close()` 不会强制关闭现有 WebSocket 连接，有客户端连接时回调永不触发
- `httpServer.close()` 会等待所有 keep-alive 连接关闭

**解决**: 实现优雅关闭机制：
1. 主动关闭所有客户端连接
2. 清空连接 Map
3. 添加强制退出超时作为兜底
4. 支持 SIGINT 和 SIGTERM 信号

**关键代码模式**:
```typescript
function gracefulShutdown(signal: string) {
  const forceExitTimeout = setTimeout(() => {
    process.exit(1);
  }, 3000);

  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close(1001, 'Server shutting down');
    }
  });
  clients.clear();

  wss.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExitTimeout);
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
```

## 浏览器扩展配置优化

### 模型动态选择

**问题**: 手动输入模型名称容易出错，用户不知道有哪些可用模型

**解决**: 改为从 `/models` 接口动态获取模型列表：
1. 添加 `fetchModels()` API 方法
2. 将输入框改为下拉选择框
3. 默认选择列表第一项
4. 提供刷新按钮重新获取模型列表

### 默认端点配置

**问题**: 默认端点 `localhost:8080` 不适用于常见的本地大模型服务

**解决**: 将默认端点改为 Ollama 标准地址 `http://127.0.0.1:11434/v1`，这是最常用的本地大模型服务端口

### 配置验证

**问题**: 用户可能在未配置模型时尝试发送消息

**解决**: 在发送消息前验证配置完整性：
- 检查 `endpoint` 和 `model` 是否已配置
- 未配置时显示错误提示引导用户到设置页面

### HTTP 响应重复发送错误

**问题**: "Cannot write headers after they are sent to the client" 错误

**原因**: HTTP 响应被多次发送，常见于以下场景：
1. **超时竞态条件**: 超时回调和 Promise 回调同时尝试发送响应
2. **流式错误处理**: 流式输出已开始后尝试调用 `writeHead`
3. **消息重复处理**: WebSocket 消息被多次触发导致重复结束响应

**解决**: 使用 `finished` 标志位防止重复响应：
1. 在请求对象中添加 `finished: boolean` 字段
2. 所有响应发送前检查 `!pending.finished`
3. 发送响应后立即设置 `finished = true`
4. 流式错误时直接写入 SSE 格式消息，不再调用 `writeHead`

**关键模式**:
```typescript
interface PendingRequest {
  finished: boolean;
}

if (pending && !pending.finished) {
  pending.finished = true;
  res.writeHead(...);
  res.end(...);
}
```

## 外部消息通知机制

### 需求场景

**问题**: 外部应用通过node-server调用浏览器插件时，如果长时间没有响应，用户无法知道请求状态

**解决**: 在侧边栏添加消息图标和红点提示，实时显示外部请求和响应状态

### 实现方案

1. **node-server通知**: 在HTTP请求开始和结束时，通过WebSocket广播`external-request`和`external-response`消息
2. **background转发**: Service Worker收到消息后通过`chrome.runtime.sendMessage`转发到sidebar
3. **sidebar显示**: 
   - 消息图标显示未读数量红点
   - 点击图标打开消息面板
   - 面板显示请求ID、模型、状态、耗时等信息

### 消息类型定义

```typescript
interface ExternalRequestPayload {
  requestId: string;
  model: string;
  messages: Array<{ role: string; content: string | null }>;
  stream: boolean;
  timestamp: number;
}

interface ExternalResponsePayload {
  requestId: string;
  status: 'success' | 'error' | 'timeout';
  content?: string | null;
  error?: string;
  duration: number;
  timestamp: number;
}
```

### 状态管理

- 使用`pending`状态标识正在处理的请求
- 请求完成后更新为`success`/`error`/`timeout`
- 面板打开时清除未读计数
