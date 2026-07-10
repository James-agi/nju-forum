# 批量制卡问题诊断

## 项目背景

这是一个南京大学知识库论坛项目（D:\nju-forum），基于 Next.js 14 + TypeScript + Prisma + PostgreSQL。

核心功能是从网页 URL 批量抓取内容，生成知识卡片入库。

## 批量制卡工作流

### 整体流程

```
创建批次 → 生成 prompt 文件 → 调用 opencode CLI 执行 → AI 读取规范 → 抓取网页 → 写卡 → 校验 → 汇总导出 → 入库
```

### 3 个阶段（每个 URL 独立执行）

1. **read_prompt_file**：AI 读取 AGENT-CARD-PROMPT.md、CARD-WORKFLOW.md 等规范文件，理解制卡规则
2. **submit_url**：抓取指定 URL 的网页内容，按规范生成知识卡片（cards.json）
3. **compare_source**：将卡片与原文细致比对，确保不重不漏

3 个阶段在同一个 opencode session 中完成（通过 `--session` 或 `-c` 参数续接上下文）。

### 关键文件

- `prisma/tools/run-card-batch.ts`：CLI Runner，负责调度执行
- `src/lib/knowledge/card-batch/web-runner.ts`：Web 端子进程管理
- `src/lib/knowledge/card-batch/storage.ts`：批次存储和 prompt 生成
- `src/app/api/knowledge/card-batches/`：API 路由
- `src/app/admin/knowledge/batch/page.tsx`：管理页面
- `agent-workflows/card-batch/runs/`：批次运行数据

## 当前问题

### 症状

批量制卡执行失败，错误信息：`Session not found` 和 `File not found`。

### 根因分析

**问题 1：中文路径编码**

批次名称包含中文（如"选课与上课"），导致：
- Node.js `spawn` 函数传递中文路径时编码错误
- opencode CLI 无法找到文件

错误日志：
```
Error: File not found: "D:/nju-forum/agent-workflows/card-batch/runs/20260602-144340-选课与上课/jobs/001-英语课/01-read-prompt.md"
```

但文件实际存在。

**问题 2：Session 管理**

多阶段任务使用 `-c` 参数续接 session，但如果 session 过期或不存在：
```
Error: Session not found
```

### 已尝试的解决方案

1. **使用 `cmd.exe /c` 替代 `spawn` 的 `shell: true`** → 失败，中文路径仍然乱码
2. **使用绝对路径替代相对路径** → 失败，中文路径仍然乱码
3. **写入临时 `.ps1` 文件用 `powershell.exe -File` 执行** → 失败，编码问题
4. **用 UTF-8 with BOM 写入 ps1 文件** → 测试通过！opencode 能正确读取中文路径

### 当前代码状态

`run-card-batch.ts` 和 `web-runner.ts` 已修改为：
- Windows 上用 `powershell.exe -File <temp.ps1>` 执行命令
- ps1 文件用 UTF-8 with BOM 编码（`0xEF 0xBB 0xBF` 前缀）
- 多阶段任务通过 `--session <sessionId>` 显式传递 session ID

## 环境信息

- OS: Windows 11
- Node.js: v24.14.0
- opencode: 1.15.13
- PowerShell: 5.1
- 默认代码页: 936 (GBK)

## 希望得到的帮助

1. 确认当前的 UTF-8 BOM 方案是否可靠
2. 如果不可靠，是否有更好的方案解决 Windows 中文路径问题
3. 是否应该放弃 opencode CLI，改为直接调用大模型 API
