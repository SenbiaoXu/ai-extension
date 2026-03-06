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

**快速开始:**
```bash
cd extension
npm install
npm run build
```

然后在 Chrome 浏览器中加载 `dist` 目录。

详细文档: [extension/README.md](extension/README.md)

### 🖥️ node-server - WebSocket中转服务器

本地 WebSocket 服务器，用于连接浏览器扩展和外部客户端。

**主要功能:**
- 接收外部消息并转发给浏览器扩展
- 接收浏览器扩展的AI推理结果并输出
- 支持流式响应

**快速开始:**
```bash
cd node-server
npm install
npm run dev
```

详细文档: [node-server/README.md](node-server/README.md)

## 数据流

```
外部客户端 → WebSocket服务器 → 浏览器扩展 → 鸿蒙AI模型
                ↑                              ↓
              结果输出 ←──────────────────── 推理结果
```

## 使用方法

1. 启动本地服务器:
   ```bash
   cd node-server && npm run dev
   ```

2. 加载浏览器扩展到 Chrome

3. 扩展会自动连接到 `ws://localhost:8765`

4. 在服务器控制台输入消息，按回车发送

5. 消息会通过扩展调用AI模型，结果返回到控制台

## 技术栈

- TypeScript
- Vite
- Chrome Extension API (Manifest V3)
- WebSocket (ws)
- OpenAI API 兼容格式
