# Agent 工作规则
针对此项目进行开发及维护时，请严格遵循以下规则，务必在以下时机完成对应步骤。

## 时机-修改代码后
时机说明: 在涉及以下场景的代码修改后触发
- 完成一个新功能的代码新增
- 完成一个现有功能的代码修改
- 完成代码重构
- 完成代码性能优化

务必完成：调用build-check技能进行错误检查。

## 时机-会话结束前
时机说明: 在会话的最后运行
务必完成：
1. 调用doc-update技能执行文档更新
2. 执行git commit 提交所有改动（包括代码、文档等）
提交信息格式:
```
<type>: <description>
<optional body>
```
类型 (Types): feat, fix, refactor, docs, test, chore, perf, ci