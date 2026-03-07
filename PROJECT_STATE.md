# 项目演进状态

## 演进时间轴

| 日期 | 里程碑 | 说明 |
|------|--------|------|
| 2026-03-06 | 项目初始化 | 创建浏览器扩展插件项目结构 |
| 2026-03-06 | 核心功能开发 | 实现侧边栏对话助手、OpenAI API兼容、流式响应 |
| 2026-03-06 | 构建配置完成 | Vite构建配置完成，TypeScript类型检查通过 |
| 2026-03-06 | WebSocket中转站 | 实现浏览器扩展作为中转站，支持WebSocket双向通信 |
| 2026-03-06 | 图标更新 | 使用Heroicons开源图标替换自定义图标 |
| 2026-03-06 | 图标格式变更 | 将图标从SVG格式转换为PNG格式 |
| 2026-03-07 | UI优化 | 移除侧边栏快捷语中的"写代码"和"翻译"按钮，修复输入框placeholder垂直居中显示 |
| 2026-03-07 | 服务器日志优化 | node-server优化流式输出日志：打印"收到聊天响应"后实时输出内容，省略stream-chunk/stream-end中间日志 |
| 2026-03-07 | 构建配置优化 | 禁用代码压缩混淆，启用sourcemap便于调试定位问题 |
| 2026-03-07 | WebSocket保活机制 | 添加心跳机制解决Service Worker空闲终止导致的连接断开问题，实现无限重连 |
| 2026-03-07 | 日志兼容性修复 | node-server修复非流式输出日志：通过isStreamingOutput标志区分流式/非流式响应，非流式时打印完整内容 |
| 2026-03-07 | 大模型接口中转站 | node-server升级为OpenAI兼容的HTTP API中转站，支持工具调用(Function Calling)、流式响应(SSE) |
| 2026-03-07 | 工具调用测试快捷语 | 侧边栏新增"调用工具"快捷语，支持通过快捷按钮测试鸿蒙端侧模型的工具调用能力 |
| 2026-03-07 | 模型选择优化 | 设置页面改为下拉选择模型，默认端点改为Ollama地址(127.0.0.1:11434)，自动获取模型列表并默认选择第一项 |
| 2026-03-07 | 外部消息查看功能 | 侧边栏新增消息图标和红点提示，支持查看外部HTTP请求和响应状态，便于排查外部调用问题 |

## 当前架构蓝图

```
ai-extension/
├── extension/           # 浏览器扩展插件
│   ├── src/
│   │   ├── background/  # Service Worker (Manifest V3) + WebSocket客户端
│   │   ├── sidebar/     # 侧边栏UI (HTML/CSS/TS)
│   │   ├── options/     # 设置页面
│   │   ├── services/    # API客户端、存储服务、WebSocket服务
│   │   └── types/       # TypeScript类型定义
│   ├── public/icons/    # 扩展图标
│   └── dist/            # 构建输出目录
└── node-server/         # 大模型接口中转站
    └── src/
        ├── index.ts     # HTTP API + WebSocket服务器
        └── types.ts     # OpenAI兼容类型定义
```

### 技术栈
- **前端**: TypeScript + Vite
- **扩展API**: Chrome Extension Manifest V3
- **UI**: 原生HTML/CSS/JavaScript
- **API**: OpenAI Chat Completions 兼容格式
- **通信**: WebSocket (ws库) + HTTP API

### 数据流
```
外部应用 → HTTP API (OpenAI兼容) → Node Server → WebSocket → 浏览器扩展 → 鸿蒙AI模型
                                        ↑                                           ↓
                                      HTTP响应 ←──────────────────────────────── 推理结果
```

## 决策存证 (ADR)

### ADR-001: 选择 Manifest V3
- **背景**: Chrome 正在逐步淘汰 Manifest V2
- **决策**: 使用最新的 Manifest V3 API
- **影响**: 需要使用 Service Worker 替代 Background Page

### ADR-002: 使用 Vite 构建
- **背景**: 需要TypeScript编译和模块打包
- **决策**: 使用 Vite 作为构建工具
- **原因**: 快速的冷启动、原生ES模块支持、简洁的配置

### ADR-003: 原生UI实现
- **背景**: 需要轻量级的UI实现
- **决策**: 使用原生HTML/CSS/JavaScript，不引入框架
- **原因**: 减小扩展体积、简化构建流程、提高加载速度

### ADR-004: WebSocket中转架构
- **背景**: 需要外部程序调用浏览器扩展中的AI能力
- **决策**: 浏览器扩展作为WebSocket客户端，连接本地服务器
- **原因**: 
  - 浏览器扩展无法作为服务器监听端口
  - 本地服务器可以作为中转站，接受外部连接
  - 扩展主动连接服务器，避免网络配置问题

### ADR-005: OpenAI兼容HTTP API
- **背景**: 需要让外部应用能够方便地调用鸿蒙端侧AI模型
- **决策**: node-server提供OpenAI兼容的HTTP API接口
- **原因**:
  - OpenAI API是最广泛使用的LLM接口标准
  - 兼容OpenAI SDK和各种第三方工具
  - 降低接入成本，无需学习新API

## 交付物清单

| 组件 | 状态 | 路径 |
|------|------|------|
| 侧边栏UI | ✅ 完成 | extension/src/sidebar/ |
| 设置页面 | ✅ 完成 | extension/src/options/ |
| 后台服务 | ✅ 完成 | extension/src/background/ |
| API客户端 | ✅ 完成 | extension/src/services/api.ts |
| WebSocket客户端 | ✅ 完成 | extension/src/services/websocket.ts |
| 类型定义 | ✅ 完成 | extension/src/types/ |
| 构建配置 | ✅ 完成 | extension/vite.config.ts |
| HTTP API服务器 | ✅ 完成 | node-server/src/ |

## 待办与风险

### 待办事项
- [ ] 添加对话历史管理功能
- [ ] 实现多会话支持
- [ ] 添加错误重试机制
- [ ] 支持Markdown渲染
- [ ] WebSocket连接状态UI显示

### 已知风险
- 鸿蒙端侧模型API端点需要用户自行部署
- SVG图标在某些Chrome版本可能不兼容，需要PNG备选
- WebSocket连接需要本地服务器先启动
