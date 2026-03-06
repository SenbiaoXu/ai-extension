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

## 常见问题解决

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
