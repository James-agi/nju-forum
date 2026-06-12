# 监控流程（每个新对话执行一次）

## 步骤 1：检查并启动服务

运行检查命令：
```
"C:/Program Files/nodejs/node.exe" -e "var h=require('http');h.get('http://127.0.0.1:4096',function(r){console.log('opencode:'+r.statusCode)}).on('error',function(){console.log('opencode:DOWN')});h.get('http://127.0.0.1:3000',function(r){console.log('next:'+r.statusCode)}).on('error',function(){console.log('next:DOWN')})"
```

若 opencode DOWN，启动：
```
cd D:/nju-forum && opencode serve > /tmp/opencode.log 2>&1 &
```

若 Next.js DOWN，启动：
```
cd D:/nju-forum && npm run dev > /tmp/nextjs.log 2>&1 &
```

## 步骤 2：检查并启动批处理守护进程

读 `agent-workflows/card-batch/runs/.monitor-status.md`，看最顶部时间戳。
若时间戳 > 60 秒前，守护进程已死。启动它（用户需批准一次）：
```
"C:/Program Files/nodejs/node.exe" "D:/nju-forum/agent-workflows/card-batch/monitor-daemon.js"
```
该命令以后台进程运行，每 30 秒刷新状态文件。

之后只需 Read 状态文件即可，无需任何批准。用户操作（启动批次、入库等）后，等几秒再读状态文件。

## 步骤 3：定位最新批次

在状态文件中搜索 `## 🔄` 或 `## ⏳` 开头的行为当前活跃批次。
若无活跃批次，取最后一个 `## ✅` 行为最近完成的批次。
汇报时优先展示最新批次详情，历史批次只列概要。

每个批次目录下的关键文件：
- `exports/import-report.md` — 入库报告（新建/更新数量）
- `exports/review-report.md` — 审核报告（job 校验结果）
- `exports/workflow-iteration-report.md` — 工作流迭代报告
- `exports/all-cards.json` — 导出的全部卡片
- `jobs/<jobDir>/cards.json` — 单个 job 的卡片
- `jobs/<jobDir>/iteration.md` — 单个 job 的迭代记录

## 步骤 4：失败原因分析

对状态为 FAILED 的 job，按以下顺序定位原因：
1. 读 job 目录下 `agent.err.log`、`agent-02-submit-url.err.log`、`agent-03-compare-source.err.log`（哪个阶段失败读哪个）
2. 若 err log 为空，读 `transcript*.md` 末尾看截断原因
3. 读 `exports/review-report.md`，检查校验失败的具体原因

汇报失败原因时用一句话概括（如"S2 submit-url 阶段网络超时"），不用贴完整日志。

## 步骤 5：检查入库（用户说"检查入库"时执行）

对已完成的 ✅ 批次，按以下顺序检查：

1. 读 `exports/import-report.md`：确认入库数量和新建/更新分布
2. 读 `exports/review-report.md`：检查是否有 FAILED job
3. 检查迭代状态：
   - **不要**只查 `exports/workflow-iteration-report.md`（汇总文件，不一定存在）
   - **要**用 Glob 扫描 `jobs/*/iteration.md`，确认每个 job 都有迭代记录
   - 读每个 iteration.md 末尾 5 行，检查 checklist 是否全通过、有无可沉淀规则
4. 可选：查询数据库验证卡片总数（用 Prisma 查 knowledgeCard.count）

汇报格式：
- 批次名 | 入库数(新建/更新) | 审核状态 | 迭代状态（X/Y jobs 有 iteration.md）
- 异常项单独说明（如 job 重复、cards=0、审核失败但仍有入库、迭代 checklist 未通过等）

## 步骤 6：批次重跑（用户说"重跑"时执行）

通过 `rerun-batch.js` 脚本调用 opencode API 重跑失败 jobs（绕过 Next.js 认证）。
脚本路径：`D:/nju-forum/rerun-batch.js`，用法：`"C:/Program Files/nodejs/node.exe" D:/nju-forum/rerun-batch.js`

重跑脚本自动跳过 EXPORTED/DONE 的 jobs，也跳过带 `closed` 标记的 jobs（如认证阻塞），只跑未关闭的 FAILED/RUNNING 的。

### closed 标记

在 batch.json 的 job 对象上加 `closed` 和 `closedReason` 字段，表示该 job 已确认不需要重跑：
- `closed: "auth-blocked"` — 需要认证才能访问的资源
- `closed: "user-reviewed"` — 用户审查后确认不需要

monitor 和重跑脚本都会识别此标记。

### 实时监控要求

用户需要看到 S1/S2/S3 每个阶段的实时进展，不能阻塞在 TaskOutput 上。

做法：
1. 用 `run_in_background: true` 启动重跑脚本
2. 设 5 分钟 CronCreate 轮询，每次检查：
   - 脚本输出文件（可能有缓冲延迟）
   - opencode session 最新时间戳（真实进度）
   - batch.json 中 job 状态变化
3. 报告格式：每个 job 列出 S1/S2/S3 ✅/🔄/❌，附时间戳
4. 脚本结束后（出现 Done/Fatal 或 task-notification），报告最终结果并删除定时任务

### 常见失败模式及修复

| 失败模式 | 原因 | 修复方式 |
|----------|------|----------|
| 缺 cards.json + iteration.md | opencode 超时/崩溃 | 重跑该 job |
| verificationStatus 不对 | AI 未设为 NEEDS_REVIEW | 直接修 cards.json，不重跑 |
| EPERM rename batch.json.tmp | 文件锁/并发冲突 | 等进程结束后再操作 |
| cards=err | JSON 格式损坏 | 检查 cards.json 内容 |

允许的命令：
allowed-tools: Bash("C:/Program Files/nodejs/node.exe" "D:/nju-forum/agent-workflows/card-batch/monitor.js":*), Bash("C:/Program Files/nodejs/node.exe" "D:/nju-forum/agent-workflows/card-batch/monitor-daemon.js":*), Bash("C:/Program Files/nodejs/node.exe" D:/nju-forum/rerun-batch.js*)
