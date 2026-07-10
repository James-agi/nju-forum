---
title: 缺口库与答案反馈改造 · Codex 执行规范
status: ready-for-execution
audience: 执行本次修改的人/AI（codex）
author: 规划（claude）
last_updated: 2026-05-30
related: PRODUCT-v1.md、CARD-WORKFLOW.md
---

# 缺口库与答案反馈改造 · Codex 执行规范

> 这份文档是**给执行者的施工图**。每个改动都标了确切文件、行为、和验收标准。
> 不要自由发挥；遇到与本文不符的现状，**停下来报告**，不要猜着改。

## 0. 背景（为什么做这三件事）

nju-forum 是「NJU 信息沉淀知识库 + 溯源问答 Agent」。作者靠**人肉填卡片**维持产品，所以一切要服务于「让作者知道该补什么、补了有成就感」。本次三件事都围绕这个：

- **任务 A（答案反馈附言）**：用户对答案点「没解决」时，可选填一句「到底缺什么」。这是作者填卡最精准的料。
- **任务 B（缺口去重改下拉）**：现在标记「重复缺口」要手填一串 cuid，反人类，改成下拉选。
- **任务 C（缺口处理留痕）**：现在缺口处理完只显示「已归档处理」四个字，作者看不到成果，像白干。改成显示「补成了哪张卡 / 重复于哪个问题」。

## 0.1 技术栈与铁律

- Next.js 14 App Router + Prisma 6 + NextAuth 5 + PostgreSQL，TypeScript。
- **Windows 环境坑**：跑 `prisma migrate` 前必须先停 dev server（占用 `query_engine-windows.dll.node` 会 EPERM）。停 server 用 `taskkill //PID <pid> //F`，先 `netstat -ano | grep ":3000" | grep LISTENING` 找 PID。迁移完重启 `npm run dev`。
- **不要用 ASCII 双引号**做中文文案里的强调（会有 TS 字符串风险，按现有代码风格用「」或不加）。
- 改完必须跑 `npm run lint` 和 `npx tsc --noEmit`，两个都要零报错。
- 每个任务结束按「验收」一节自检。

---

## 任务 A：答案反馈附言（可选填写 + 鼓励填写）

### A.1 现状

已有一条最小反馈链路（上一轮已实现，不要推翻，只在其上扩展）：
- 表 `KnowledgeAnswerFeedback`：字段 `id / questionId / userId / createdAt`，有 `@@unique([questionId, userId])`。
- 提交 API：`src/app/api/knowledge/answer-feedback/route.ts`（POST，登录用户，按复合唯一键 upsert 去重）。
- 用户入口：`src/components/knowledge/question-box.tsx` 里的 `UnsolvedButton` 子组件，点一下立即提交。
- 查看页：`src/app/admin/knowledge/feedback/page.tsx` + 列表 API `src/app/api/knowledge/answer-feedback/list/route.ts`（按 questionId 聚合次数）。

### A.2 要改成什么

让用户点「这没解决我的问题」后，**展开一个可选输入框**，鼓励但不强制填写一句「缺什么」，再提交。作者在查看页能看到这些附言。

### A.3 改动清单

**A.3.1 数据库（schema.prisma）**
- 给 model `KnowledgeAnswerFeedback` 加字段：`note String? @db.Text`（可空）。
- 跑 migration：先停 dev server，再 `npx prisma migrate dev --name add_feedback_note`，完成后重启 dev server。

**A.3.2 提交 API（src/app/api/knowledge/answer-feedback/route.ts）**
- 从 body 读取可选 `note`：`typeof payload?.note === "string" ? payload.note.trim().slice(0, 2000) : null`（限长 2000，空串转 null）。
- upsert 时：`create` 带上 `note`；`update` 改为 `{ note }`（允许用户第二次提交时补/改附言，不再是空 update）。
- 不要让 note 变成必填，缺了也要成功。

**A.3.3 用户前端（question-box.tsx 的 UnsolvedButton）**
- 把「点一下立即提交」改为两段式：
  1. 初始只显示一个轻量按钮「这没解决我的问题」。
  2. 点击后，**不立即提交**，而是展开：一个 `Textarea`（placeholder 用鼓励语，见下）+ 一个「提交反馈」按钮 + 一个「跳过，直接提交」按钮。
  3. Textarea 非必填。「提交反馈」带 note 提交；「跳过」不带 note 提交。两者都走同一个 POST。
- 鼓励语（放 placeholder 或上方小字，**语气按 CARD-WORKFLOW.md 的平视过来人风，不要爹味**）：
  示例：`说一句哪里没解决？比如你其实想问的是…… 作者会照着补卡片。`（可选填，留空也能交）
- 提交成功后显示：`已记录，谢谢。你说的会帮作者补到卡片里。`
- 保留原有的 sending / error 态处理。换问题时靠 `key={answer.questionId}` 重置（已有，别动）。

**A.3.4 列表 API（answer-feedback/list/route.ts）**
- 现在按 questionId 用 `groupBy` 聚合，只返回 count。**问题：附言 note 是逐条的，聚合会丢。**
- 改为：除了返回每个 question 的 count、lastFeedbackAt，**还要返回该问题下所有非空 note 的数组**（按时间倒序）。
  - 实现建议：`groupBy` 拿 count/lastAt 不变；再单独 `findMany` 查 `note: { not: null }` 的反馈（select questionId + note + createdAt），在内存里按 questionId 归组塞进结果。
  - 返回结构每项加：`notes: { text: string; createdAt: string }[]`。

**A.3.5 查看页（admin/knowledge/feedback/page.tsx）**
- 每条反馈卡片下，若 `notes` 非空，列出这些附言（引用样式，类似 question-box 里 claimText 的左边线样式）。空的就不显示。
- 文案区分：count 是「点没解决的次数」，notes 是「用户留下的话」。

### A.4 任务 A 验收
- [ ] migration 成功，`KnowledgeAnswerFeedback` 有 note 字段。
- [ ] 用户点按钮 → 展开输入框 → 填或不填都能提交成功。
- [ ] 同一用户对同一问题二次提交并填了 note，note 被更新（不报唯一键冲突）。
- [ ] 查看页能看到某问题的次数 + 用户留下的附言。
- [ ] lint + tsc 零报错。

<!-- APPEND-MARKER -->

---

## 任务 B：缺口去重改下拉（消灭手填 cuid）

### B.1 现状（确切位置）

- 缺口列表组件：`src/components/knowledge/gap-list.tsx`。
- 第 179-197 行：标记「重复」时，用一个 `<Input placeholder="重复缺口 ID">` 让作者**手打另一个缺口的 cuid**，再点按钮提交。这是要消灭的反人类设计。
- 第 152-156 行：已标记 DUPLICATE 的缺口，展示「重复于 {gap.duplicateOfId}」——直接显示了一串 cuid，不是人能读的。
- 状态 `duplicateByGap`（第 48 行）存的是手填的 cuid 字符串。
- 提交走 `updateGap(gap, "DUPLICATE")`（第 51-81 行），body 里带 `duplicateOfId`。

### B.2 要改成什么

把「手填 cuid」换成「从下拉里选另一个缺口的**问题文本**」。

### B.3 改动清单（只动前端 gap-list.tsx，后端/schema 不用动）

- 组件已经接收了 `gaps: KnowledgeGapDTO[]`（当前页所有缺口）。重复来源就从这个列表里选。
- 把第 179-197 行那段 Input + 按钮，替换为一个 `Select`：
  - 选项 = 其它缺口（**排除当前 gap 自己**：`gaps.filter(g => g.id !== gap.id)`）。
  - 每个选项显示该缺口的 `originalQuestion`（截断过长，比如 `.slice(0, 40)`），value 是它的 `id`。
  - 选中后存进 `duplicateByGap[gap.id]`（复用现有 state，存的从「手打的 cuid」变成「选中的 id」，逻辑不变）。
  - 旁边保留「标记重复」按钮，点击走原 `updateGap(gap, "DUPLICATE")`。
- 把第 152-156 行「重复于 {duplicateOfId}」改为显示**问题文本**：用 `gaps.find(g => g.id === gap.duplicateOfId)?.originalQuestion ?? gap.duplicateOfId` 兜底（找不到就还显示 id，别崩）。
- 注意：`gaps` 列表可能因分页/筛选不含目标缺口，所以下拉可能选不到很久以前的缺口——**这是已知限制，本次不解决**（P0 缺口量小，够用）。但兜底显示要做（上一条）。

### B.4 任务 B 验收
- [ ] 标记重复时是下拉选问题文本，不再手打 cuid。
- [ ] 下拉里不含当前缺口自己。
- [ ] 已标记重复的缺口，展示的是「重复于：<问题文本>」而非 cuid。
- [ ] lint + tsc 零报错。

---

## 任务 C：缺口处理留痕（让作者看到成果，不再像白干）

### C.1 现状（确切位置）

- `src/components/knowledge/gap-list.tsx` 第 199-201 行：缺口 status 非 OPEN 时，操作列只显示一行干字 `<span>已归档处理</span>`。
- **后端其实已经把成果数据给了**（不用改后端）：
  - GET API `src/app/api/knowledge/gaps/route.ts` 已按 OPEN 优先排序、已返回 `linkedCardSummary`。
  - `KnowledgeGapDTO` 里有 `linkedCardSummary`（HANDLED 时是补成的卡片摘要）、`duplicateOfId`（DUPLICATE 时是重复来源）。
  - 这些数据现在**前端没展示**，被浪费了。本任务核心就是把它们显示出来。

### C.2 要改成什么

已处理的缺口不再是「已归档处理」一句空话，而是显示**处理成果**：
- HANDLED → 显示「已补为：《<linkedCardSummary>》」。如果该卡片在 `cards` 列表里能找到（`cards.find(c => c.summary === linkedCardSummary)` 或更可靠地用 linkedCardId 比对），可做成可点击/可定位（非必须，能显示摘要即可）。
- DUPLICATE → 显示「重复于：<目标缺口问题文本>」（用任务 B 同样的查找方式）。
- OUT_OF_SCOPE → 显示「已标记不属 P0」。

### C.3 改动清单（只动前端 gap-list.tsx）

- 把第 199-201 行的 `else` 分支（非 OPEN 时显示「已归档处理」）替换为一个根据 status 分流的展示：
  - 用 `gap.status` 判断，分别渲染上面 C.2 的三种文案。
  - 样式：小字、muted，但要让「成果」本身（卡片摘要/问题文本）醒目一点（比如正常色或加书名号）。
- 「关联卡片」列（第 130-157 行）当前在未处理时显示选择器、已处理(HANDLED)时显示 `linkedCardSummary`——这部分已 OK，不用动。重点是操作列的留痕。
- 排序：后端已做 OPEN 优先，前端不用再排。确认列表里 OPEN 在上、已处理在下即可。

### C.4 任务 C 验收
- [ ] 已处理(HANDLED)缺口显示「已补为：《卡片摘要》」。
- [ ] 重复(DUPLICATE)缺口显示「重复于：<问题文本>」。
- [ ] 不属 P0 的显示对应文案。
- [ ] OPEN 缺口仍排在最前，操作按钮正常。
- [ ] lint + tsc 零报错。

---

## 全局收尾

1. 三个任务做完，统一跑一遍 `npm run lint` + `npx tsc --noEmit`，确保零报错。
2. **不做的事（明确排除，别顺手做）**：
   - 不做「填补缺口后通知当初提问者」（问题 4，依赖消息机制，本次不碰）。
   - 不动 RAG / answer.ts / retrieval.ts。
   - 不改卡片数据结构、不碰卡片层级（那是另一个大任务）。
3. 改完留一句话说明：每个任务动了哪些文件、migration 名字是什么。
4. 视觉验证：作者本机开着 Chrome 会导致自动化浏览器起不来，**人工在浏览器自测**这几个页面（/knowledge 问答页、/admin/knowledge/feedback、/admin/gaps）。

## 语气要求（A.3.3 的鼓励语、所有面向用户的文案）

所有给用户看的话，遵循 CARD-WORKFLOW.md §3：像过来人平视唠两句，不要班主任教学腔。不堆「务必/请务必/必须」，不套【】标签。自检：「这像学长跟我说的话，还是辅导员发的通知？」

