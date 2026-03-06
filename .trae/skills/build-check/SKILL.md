---
name: build-check
description: 在修改代码后调用此技能，专注于快速高效地修复 TypeScript、编译和构建错误。
---

# 构建检查技能
专注于快速高效地修复 TypeScript、编译和构建错误，使用最小的改动让构建通过，不涉及任何架构修改。
## 核心职责
1. **TypeScript 错误解决** - 修复类型错误、推断问题、泛型约束。
2. **构建错误修复** - 解决编译失败、模块解析（Module Resolution）问题。
3. **依赖问题** - 修复导入错误、缺失的包、版本冲突。
4. **配置错误** - 解决 `tsconfig.json`、Vite 配置问题。
5. **最小差异修改 (Minimal Diffs)** - 尽可能通过最小的改动来修复错误。
6. **禁止架构更改** - 仅修复错误，不进行重构或重新设计。

## 可用工具

### 构建与类型检查工具
- **tsc** - 用于类型检查的 TypeScript 编译器。
- **npm/yarn** - 包管理。
- **eslint** - 代码检查（可能导致构建失败）。
- **vite build** - Vite 生产环境构建。

### 诊断命令
```bash
# TypeScript 类型检查（不输出文件）
npx tsc --noEmit

# 带有美化输出的 TypeScript 检查
npx tsc --noEmit --pretty

# 显示所有错误（不在第一个错误处停止）
npx tsc --noEmit --pretty --incremental false

# 检查特定文件
npx tsc --noEmit path/to/file.ts

# ESLint 检查
npx eslint . --ext .ts,.tsx,.js,.jsx

# Vite 构建（生产环境）
npm run build

# 带有调试信息的 Vite 构建
npm run build -- --debug
```

## 错误处理工作流

### 1. 收集所有错误
```
a) 运行完整的类型检查
   - npx tsc --noEmit --pretty
   - 捕获所有错误，而不只是第一个

b) 按类型对错误进行分类
   - 类型推断失败
   - 缺失类型定义
   - 导入/导出错误
   - 配置错误
   - 依赖问题

c) 按影响程度排序
   - 阻塞构建的问题：优先修复
   - 类型错误：按顺序修复
   - 警告：时间允许时修复
```

### 2. 修复策略（最小改动）
```
针对每个错误：

1. 理解错误
   - 仔细阅读错误信息
   - 检查文件和行号
   - 理解“预期类型”与“实际类型”的区别

2. 寻找最小修复方案
   - 添加缺失的类型注解
   - 修复导入语句
   - 添加空值检查（Null check）
   - 使用类型断言（仅作为最后手段）

3. 验证修复是否破坏了其他代码
   - 每次修复后再次运行 tsc
   - 检查相关文件
   - 确保没有引入新的错误

4. 迭代直至构建通过
   - 一次只修复一个错误
   - 每次修复后重新编译
   - 跟踪进度（已修复 X/Y 个错误）
```

### 3. 常见错误模式与修复

**模式 1：类型推断失败**
```typescript
// 错误：参数 'x' 隐式具有 'any' 类型
function add(x, y) {
  return x + y
}

// 修复：添加类型注解
function add(x: number, y: number): number {
  return x + y
}
```

**模式 2：Null/Undefined 错误**
```typescript
// 错误：对象可能为 'undefined'
const name = user.name.toUpperCase()

// 修复：可选链 (Optional chaining)
const name = user?.name?.toUpperCase()

// 或者：空值检查
const name = user && user.name ? user.name.toUpperCase() : ''
```

**模式 3：缺失属性**
```typescript
// 错误：类型 'User' 上不存在属性 'age'
interface User {
  name: string
}
const user: User = { name: 'John', age: 30 }

// 修复：在接口中添加属性
interface User {
  name: string
  age?: number // 如果不总是存在，则设为可选
}
```

**模式 4：导入错误**
```typescript
// 错误：找不到模块 '@/lib/utils'
import { formatDate } from '@/lib/utils'

// 修复 1：检查 tsconfig 路径配置是否正确
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// 修复 2：使用相对路径导入
import { formatDate } from '../lib/utils'

// 修复 3：安装缺失的包
npm install @/lib/utils
```

**模式 5：类型不匹配**
```typescript
// 错误：类型 'string' 不能赋值给类型 'number'
const age: number = "30"

// 修复：将字符串解析为数字
const age: number = parseInt("30", 10)

// 或者：更改类型
const age: string = "30"
```

**模式 6：泛型约束**
```typescript
// 错误：类型 'T' 不能赋值给类型 'string'
function getLength<T>(item: T): number {
  return item.length
}

// 修复：添加约束
function getLength<T extends { length: number }>(item: T): number {
  return item.length
}

// 或者：更具体的约束
function getLength<T extends string | any[]>(item: T): number {
  return item.length
}
```

**模式 7：Vue3 Composition API 错误**
```typescript
// 错误：在 setup 函数外部调用 Composition API
import { ref } from 'vue'

const count = ref(0) // 错误！必须在 setup 函数中

function MyComponent() {
  return <div>{count.value}</div>
}

// 修复：在 setup 函数中使用
import { ref } from 'vue'

export default {
  setup() {
    const count = ref(0)
    return { count }
  }
}
```

**模式 8：Async/Await 错误**
```typescript
// 错误：'await' 表达式仅允许在异步函数中使用
function fetchData() {
  const data = await fetch('/api/data')
}

// 修复：添加 async 关键字
async function fetchData() {
  const data = await fetch('/api/data')
}
```

**模式 9：找不到模块**
```typescript
// 错误：找不到模块 'vue' 或其相应的类型声明
import { ref } from 'vue'

// 修复：安装依赖
npm install vue

// 检查：验证 package.json 中是否存在该依赖
{
  "dependencies": {
    "vue": "^3.4.0"
  }
}
```

**模式 10：Vite 特定错误**
```typescript
// 错误：Vite 客户端模块解析失败
// 通常是由于 vite.config.ts 配置错误导致的

// 修复：检查 vite.config.ts 配置
// 错误写法
export default defineConfig({
  // 缺少 base 配置或其他必要配置
})

// 正确写法
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

## 项目特定构建问题示例

### Vue3 + Vite 兼容性
```typescript
// 错误：Vue3 响应式 API 类型问题
import { ref } from 'vue'

const count = ref(0)
// 如果直接赋值，响应式会丢失
count = 1 // 错误！

// 修复：使用 .value 修改响应式值
count.value = 1

// 或者使用 reactive 用于对象
import { reactive } from 'vue'

const state = reactive({
  count: 0
})
state.count = 1
```

### Supabase 客户端类型
```typescript
// 错误：类型 'any' 不可赋值
const { data } = await supabase
  .from('markets')
  .select('*')

// 修复：添加类型注解
interface Market {
  id: string
  name: string
  slug: string
  // ... 其他字段
}

const { data } = await supabase
  .from('markets')
  .select('*') as { data: Market[] | null, error: any }
```

### Redis Stack 类型
```typescript
// 错误：类型 'RedisClientType' 上不存在属性 'ft'
const results = await client.ft.search('idx:markets', query)

// 修复：使用正确的 Redis Stack 类型
import { createClient } from 'redis'

const client = createClient({
  url: process.env.REDIS_URL
})

await client.connect()

// 现在类型可以正确推断
const results = await client.ft.search('idx:markets', query)
```

### Solana Web3.js 类型
```typescript
// 错误：类型 'string' 的参数不能赋值给 'PublicKey'
const publicKey = wallet.address

// 修复：使用 PublicKey 构造函数
import { PublicKey } from '@solana/web3.js'
const publicKey = new PublicKey(wallet.address)
```

## 最小差异修改策略 (Minimal Diff Strategy)

**关键点：进行尽可能小的改动**

### 应该做：
- 在缺失的地方添加类型注解
- 在需要的地方添加空值检查
- 修复导入/导出
- 添加缺失的依赖
- 更新类型定义
- 修复配置文件

### 不该做：
- 重构不相关的代码
- 更改架构
- 重命名变量/函数（除非它们导致错误）
- 添加新功能
- 更改逻辑流（除非是为了修复错误）
- 优化性能
- 改善代码风格

**最小差异修改示例：**

```typescript
// 文件有 200 行，错误在第 45 行

// 错误做法：重构整个文件
// - 重命名变量
// - 提取函数
// - 更改模式
// 结果：改动了 50 行

// 正确做法：只修复错误
// - 在第 45 行添加类型注解
// 结果：改动了 1 行

function processData(data) { // 第 45 行 - 错误：'data' 隐式具有 'any' 类型
  return data.map(item => item.value)
}

// 最小修复：
function processData(data: any[]) { // 仅修改此行
  return data.map(item => item.value)
}

// 更好的最小修复（如果已知类型）：
function processData(data: Array<{ value: number }>) {
  return data.map(item => item.value)
}
```

## 构建错误修复报告格式

```markdown
# 构建错误修复报告

**日期：** YYYY-MM-DD
**构建目标：** Vite 生产环境 / TypeScript 检查 / ESLint
**初始错误数：** X
**已修复错误数：** Y
**构建状态：** 通过 / 失败

## 已修复的错误

### 1. [错误类别 - 例如：类型推断]
**位置：** `src/components/MarketCard.tsx:45`
**错误信息：**
```
Parameter 'market' implicitly has an 'any' type.
```

**根本原因：** 函数参数缺失类型注解

**应用的修复：**
```diff
- function formatMarket(market) {
+ function formatMarket(market: Market) {
    return market.name
  }
```

**修改行数：** 1
**影响：** 无 - 仅类型安全性提升

---

### 2. [下一个错误类别]

[相同格式]

---

## 验证步骤

1. TypeScript 检查通过：`npx tsc --noEmit`
2. Vite 构建成功：`npm run build`
3. ESLint 检查通过：`npx eslint .`
4. 未引入新错误
5. 开发服务器正常运行：`npm run dev`

## 总结

- 解决的总错误数：X
- 修改的总行数：Y
- 构建状态：通过
- 修复耗时：Z 分钟
- 阻塞性问题：剩余 0 个

## 后续步骤

- [ ] 运行完整测试套件
- [ ] 在生产构建中验证
- [ ] 部署到暂存环境进行 QA
```

## 何时使用此智能体 (Agent)

**在以下情况下使用：**
- `npm run build` 失败
- `npx tsc --noEmit` 显示错误
- 类型错误阻塞了开发
- 导入/模块解析错误
- 配置错误
- 依赖版本冲突

**不要在以下情况下使用：**
- 代码需要重构（请使用 refactor-cleaner）
- 需要更改架构（请使用 architect）
- 需要新功能（请使用 planner）
- 测试失败（请使用 tdd-guide）
- 发现安全问题（请使用 security-reviewer）

## 构建错误优先级

### 关键 (Critical - 立即修复)
- 构建完全崩溃
- 无法运行开发服务器
- 生产部署受阻
- 多个文件报错

### 高 (High - 尽快修复)
- 单个文件报错
- 新代码中的类型错误
- 导入错误
- 非关键的构建警告

### 中 (Medium - 有空时修复)
- Linter 警告
- 过时的 API 使用
- 非严格模式的类型问题
- 次要配置警告

## 快捷参考命令

```bash
# 检查错误
npx tsc --noEmit

# 构建 Vite
npm run build

# 清除缓存并重新构建
rm -rf dist node_modules/.cache
npm run build

# 检查特定文件
npx tsc --noEmit src/path/to/file.ts
```
# 安装缺失的依赖
npm install

# 自动修复 ESLint 问题
npx eslint . --fix

# 更新 TypeScript
npm install --save-dev typescript@latest

# 重新验证 node_modules
rm -rf node_modules package-lock.json
npm install
```

## 成功指标

构建错误修复后：
- `npx tsc --noEmit` 以退出代码 0 结束
- `npm run build` 成功完成
- 未引入新错误
- 构建时间未显著增加
- 开发服务器运行无误
- 测试仍然通过

---

**请记住**：目标是使用最少的改动快速修复错误。不要重构，不要优化，不要重新设计。修复错误，验证构建通过，然后继续。速度和精准度优于完美。