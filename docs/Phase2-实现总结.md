---
title: Phase 0-2 实现总结
status: 过时（知识问答已全盘重构，见 docs/KNOWLEDGE-ARCHITECTURE.md）
audience: 作者本人
---

# Phase 0-2 实现总结

## Phase 0：问题分桶（已完成）

用 `temp-phase0-diagnose.ts` 跑通当前管道，16 个测试问题分桶结果：

- **热修已覆盖**：同义词/别名（一卡通/校园卡）、缩写/全称（转专业/转CS）大部分已修
- **剩余失败**：门槛错杀（保研 topScore=9、宿舍 topScore=6）+ 多卡分散（新生入学 topScore=2、学费 topScore=5）
- 输出：`docs/Phase0-问题分桶-基线.md`

## Phase 1：语义检索验证（已完成）

- **Task 1.1**：Embedding 探针 → DeepSeek/xiaomimimo 不支持，Silicon Flow + BGE-M3 可用（dim=1024）
- **Task 1.2**：320 张卡全部向量化，存入 `temp-card-vectors.json`，0 失败
- **Task 1.3**：多样本对照实验 → 语义检索能捞到关键词漏掉的卡（如"新生报到要带什么材料"、"转CS官方流程"），方向成立

## Phase 1.5：向量生产化设计（已完成）

- 输出：`docs/Phase1.5-向量生产化设计.md`
- 决策：pgvector 在 Windows 上安装困难，先用**内存向量索引**（320 张卡 < 1ms），后续可迁 pgvector

## Phase 2：混合召回实现（已完成）

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/lib/knowledge/embedding.ts` | Embedding API 调用 + 内存向量索引 + 降级状态追踪 |
| `src/lib/knowledge/vector-store.ts` | 向量持久化（JSON 文件）+ 增量更新 + 批量回填 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/knowledge/retrieval.ts` | 新增 `retrieveHybrid()` 混合召回入口 + `hasStrongEvidence()` 识别语义结果 |
| `src/app/api/knowledge/ask/route.ts` | 改用 `retrieveHybrid()` + 启动时加载向量索引 |
| `src/app/api/knowledge/cards/route.ts` | POST 后异步更新 embedding |
| `src/app/api/knowledge/cards/[id]/route.ts` | PATCH 后异步更新 embedding |
| `.env` | 新增 embedding 配置 |

### Task 2.3：回填

- 已有 `temp-embed-cards.ts` 批量生成 `temp-card-vectors.json`
- `vector-store.ts` 的 `backfillAllCards()` 支持增量回填（跳过已有向量的卡）

### Task 2.4：增量保鲜

- 卡片创建/编辑时异步调用 `upsertCardVector()`
- 不阻塞响应，失败只记日志
- 向量写入 `temp-card-vectors.json`，下次启动自动加载

### 验证结果

7 个测试问题全部通过 evidence 检查（Phase 0 有 4 个失败）。

## 停点检查

### 停点 B2：Phase 2 后

> 如果回填与增量保鲜没有真正实现，只停留在设计层：停，不进入后续主链路集成。

**检查结果：**
- ✅ 回填已实现：`temp-embed-cards.ts` + `vector-store.ts::backfillAllCards()`
- ✅ 增量保鲜已实现：`upsertCardVector()` 在卡片创建/编辑时异步调用
- ✅ 向量已持久化：`temp-card-vectors.json`（320 张卡，断点续跑）

**结论：停点 B2 通过，可以进入后续阶段。**

## 下一步（Phase 3-6，本轮未做）

按任务单顺序：
1. Phase 3：聚合判断层（evidence aggregation）
2. Phase 4：understanding 参与检索
3. Phase 5：回答层增强
4. Phase 6：ask 主链路重排

## 临时文件（验证用，可删）

- `temp-embed-probe*.ts` — embedding 探针
- `temp-phase0-diagnose.ts` — Phase 0 诊断
- `temp-semantic-search.ts` — 语义 vs 关键词对照
- `temp-hybrid-test.ts` — 混合召回验证
- `temp-card-vectors.json` — 向量数据（生产也保留）
