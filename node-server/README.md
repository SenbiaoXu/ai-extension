# 鸿蒙AI助手 - 本地服务器

WebSocket 中转服务器，用于连接浏览器扩展和外部客户端。

## 功能

- WebSocket 服务器，监听客户端连接
- 接收外部消息并转发给浏览器扩展
- 接收浏览器扩展的 AI 推理结果并输出

## 数据流

```
外部客户端 → WebSocket服务器 → 浏览器扩展 → 鸿蒙AI模型
                ↑                              ↓
              结果输出 ←──────────────────── 推理结果
```

## 安装

```bash
npm install
```

## 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 使用方法

1. 启动服务器后，服务器会监听 `ws://localhost:8765`
2. 浏览器扩展会自动连接到服务器
3. 在控制台输入文本，按回车发送测试消息
4. 消息会被转发到浏览器扩展，调用 AI 模型推理
5. 推理结果会打印在控制台

## 消息格式

### 发送聊天消息
```json
{
  "type": "chat",
  "payload": {
    "messages": [
      { "role": "user", "content": "你好" }
    ]
  }
}
```

### 接收响应
```json
{
  "type": "chat-response",
  "payload": {
    "content": "你好！我是鸿蒙AI助手..."
  }
}
```

### 流式响应
```json
{ "type": "stream-chunk", "payload": { "content": "你" } }
{ "type": "stream-chunk", "payload": { "content": "好" } }
{ "type": "stream-end" }
```

## 配置

环境变量：
- `PORT`: 服务器端口，默认 `8765`
