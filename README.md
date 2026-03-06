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

**快速开始:**
```bash
cd extension
npm install
npm run build
```

然后在 Chrome 浏览器中加载 `dist` 目录。

详细文档: [extension/README.md](extension/README.md)

### 🖥️ node-server - 后端服务

Node.js 后端服务（待开发）。

## 开发指南

1. 克隆项目
2. 进入对应目录安装依赖
3. 运行开发命令

## 技术栈

- TypeScript
- Vite
- Chrome Extension API (Manifest V3)
- OpenAI API 兼容格式
