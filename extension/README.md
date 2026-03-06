# 鸿蒙AI助手 - 浏览器扩展插件

连接鸿蒙端侧模型的浏览器扩展，支持在浏览器中直接调用鸿蒙端侧模型进行推理。

## 功能特性

- **侧边栏对话助手** - 简约美观的用户界面
- **OpenAI API兼容** - 支持标准OpenAI Chat Completions API格式
- **流式响应支持** - 实时显示生成的文本，提升用户体验
- **灵活配置** - 可自定义API端点、模型参数等
- **现代UI设计** - 响应式设计，流畅的动画效果

## 安装方法

### 开发模式

1. 安装依赖：
   ```bash
   npm install
   ```

2. 构建扩展：
   ```bash
   npm run build
   ```

3. 在Chrome浏览器中加载扩展：
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `dist` 目录

### 开发调试

```bash
# 监听模式，自动重新构建
npm run dev
```

## 使用方法

1. 点击浏览器工具栏中的扩展图标打开侧边栏
2. 首次使用需要配置API端点（点击设置按钮）
3. 配置完成后即可开始对话

## 配置说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API端点 | 鸿蒙端侧模型服务地址 | `http://localhost:8080/v1` |
| API密钥 | 认证密钥（可选） | - |
| 模型名称 | 使用的模型名称 | `harmonyos-default` |
| 温度 | 输出随机性控制 | `0.7` |
| 最大令牌数 | 生成文本最大长度 | `2048` |
| 流式响应 | 是否启用实时输出 | `开启` |

## API 兼容性

本扩展支持标准 OpenAI Chat Completions API 格式：

```typescript
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "harmonyos-default",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": true
}
```

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **Vite** - 快速的构建工具
- **Chrome Extension Manifest V3** - 最新的浏览器扩展API

## 项目结构

```
extension/
├── src/
│   ├── background/     # Service Worker 后台脚本
│   ├── sidebar/        # 侧边栏UI
│   ├── options/        # 设置页面
│   ├── services/       # API和存储服务
│   └── types/          # TypeScript类型定义
├── public/
│   └── icons/          # 扩展图标
├── manifest.json       # 扩展清单
├── vite.config.ts      # Vite配置
└── package.json        # 项目配置
```

## 许可证

MIT License
