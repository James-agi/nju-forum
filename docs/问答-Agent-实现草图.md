---
title: 问答 Agent——实现草图
status: 草案 v0.1
audience: 作者本人。定方向用，不是施工详图。
last_updated: 2026-06-15
related: 问答-Agent-框架草图.md；ask/route.ts；retrieval.ts；answer.ts；scope.ts
---

# 问答 Agent——实现草图

> 这份回答的不是“方向对不对”，而是：**如果真要做问答 agent，现有代码该怎么拆**。
> 一句话定位：把现在一次性检索的 ask/route.ts，拆成“理解 → 反问判断 → 检索计划 → 检索执行 → 综合回答”五段。

---

## 1. 现状：ask/route.ts 现在其实是一条直管

现在基本是：

```text
收问题 → scope 判断 → 检索一次 → 证据判断 → 直接答 / 记 gap
```

优点：简单、稳。
问题：不会想，不会问，不会补搜。

所以要改的不是某一行，而是把这条“直管”拆成几段。

---

## 2. 要拆成哪五段

### 第 1 段：Question Understanding（理解问题）

输入：用户原问题
输出：一份结构化理解结果

至少要产出这些字段：
- `questionType`: 事实 / 流程 / 建议 / 比较 / 选择
- `intentSummary`: 用一句人话概括“用户真正想问什么”
- `needsClarification`: 是否需要反问
- `clarificationQuestion`: 如果要反问，问什么
- `searchTerms`: 第一轮建议搜索词
- `searchHints`: 建议先搜哪类信息

这一步的本质：
**不是回答问题，而是把问题读懂。**

---

### 第 2 段：Clarification Gate（反问判断）

如果 `needsClarification = true`，不继续往下答，直接返回：

```json
{
  "status": "CLARIFICATION_NEEDED",
  "question": "你是想问转专业流程，还是想问不同专业怎么选？"
}
```

这一步的意义：
别对一个没问清楚的问题硬答。

注意：
- 不是所有问题都反问
- 只有太宽、太含糊、太容易跑偏的问题才反问
- 反问只能一句，不能盘问

---

### 第 3 段：Retrieval Planning（检索规划）

如果问题够清楚，就进入规划层。

输入：理解结果
输出：一份检索计划

例如：
- `round1`: 先搜政策 / 条件类卡
- `round2`: 再搜建议 / 比较类卡
- `round3`: 还不够再补误区类卡

这一步不是直接搜，而是先决定：
- 先搜什么
- 后搜什么
- 哪一轮搜不到就该停

关键：
**从“一次性搜完”变成“按轮次搜”。**

---

### 第 4 段：Retrieval Execution（按计划检索）

这一层还复用现有 `retrieveKnowledgeCards`，只是从“一次调用”变成“按计划跑多次”。

比如：
1. 先跑第一轮搜索词
2. 看证据够不够
3. 不够就按第二轮词再搜一次
4. 合并结果，再评估

这一步依然保留你现在的优点：
- 卡片不动
- 现有搜索逻辑尽量复用
- 现有 evidence 判定尽量复用

但它的行为从“搜一次就结束”，变成“知道什么时候该补搜一次”。

---

### 第 5 段：Answer Composition（综合回答）

检索结果够了之后，才进入回答。

输入：
- 用户原问题
- 问题理解结果
- 检索出的多张卡

输出：
- 连贯的自然语言回答
- 对应 citations

和现在不同的是：
回答时不只是“把卡片内容说顺”，而是要参考第 1 段的 `intentSummary` 来组织结构。

也就是：
**先按“用户真正关心什么”组织答案，再把卡揉进去。**

---

## 3. ask/route.ts 未来应该长什么样

目标不是继续把逻辑堆在 route 里，而是把 route 变成一个编排器。

理想状态：

```text
POST /ask
  → classifyP0Scope()
  → understandQuestion()
  → if needs clarification: return clarification
  → buildRetrievalPlan()
  → executeRetrievalPlan()
  → evaluateEvidence()
  → if insufficient: gap
  → composeAnswer()
  → save answer + citations
```

也就是说，`ask/route.ts` 未来不该“自己干所有事”，
它应该只是按顺序调用几个明确模块。

---

## 4. 需要新增的模块（不是现在立刻写，只是先定名）

建议未来拆出这几个文件：

- `question-understanding.ts`
  - 负责把原问题变成结构化理解结果

- `clarification.ts`
  - 负责判断是否该反问，以及返回什么反问句

- `retrieval-plan.ts`
  - 负责把问题理解结果变成检索轮次计划

- `retrieval-executor.ts`
  - 负责按计划跑多轮搜索，并合并结果

- `answer-composer.ts`
  - 负责把理解结果 + 检索结果 组织成更像“聊天”的回答

这一步的意义不是“多建文件”，而是避免 ask/route.ts 长成一团。

---

## 5. 第一版别做太多

第一版只做最小闭环：

1. **先加 Question Understanding**
   - 能分出问题类型
   - 能产 `intentSummary`
   - 能给出一组搜索词

2. **先不急着做很多反问**
   - 第一版只拦最明显的宽问题

3. **先只做两轮检索**
   - 第一轮：核心词
   - 第二轮：补充词

4. **先让回答更像聊天，而不是复读**
   - 但不碰“卡外知识不能乱补”红线

第一版目标不是“一步到位很聪明”，
而是先让它从“死的一次性搜索”升级成“会理解、会补搜一次”。

---

## 6. 这份实现草图的核心判断

真正该改的不是：
- 多几个标签
- 多几个 alias
- 多几个关键词规则

真正该改的是：
**让 ask 从“单次函数调用”变成“一个小流程”。**

也就是：
- 先理解
- 再决定要不要问
- 再决定怎么搜
- 不够再补搜
- 最后再答

这才是问答 agent，而不是一个更复杂的搜索机。
