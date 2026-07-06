---
title: Phase 1.5 向量生产化设计
status: 设计稿 v1.0
audience: 执行 agent + 作者本人
last_updated: 2026-06-15
related: retrieval.ts；prisma/schema.prisma；temp-card-vectors.json
---

# Phase 1.5 向量生产化设计

> Phase 1 验证通过：BGE-M3 embedding + 关键词混合检索方向成立。
> 本文件定义向量如何从临时 JSON 落地到生产环境。

---

## 1. 存储方案

### 选择：pgvector 扩展 + KnowledgeCard 新增 embedding 列

**理由：**
- 已有 PostgreSQL，装 pgvector 扩展即可
- 向量和卡片在同一库，查询时无需跨服务
- 320 张卡 × 1024 维 × float32 ≈ 1.3MB，数据量极小

### Schema 变更

```prisma
// prisma/schema.prisma - KnowledgeCard 模型新增：
model KnowledgeCard {
  // ... 现有字段不变 ...
  embedding Unsupported("vector(1024)")?
}
```

**注意：** Prisma 不原生支持 `vector` 类型，需要用 `Unsupported("vector(1024)")` 声明，raw query 读写。

### 数据库迁移

```sql
-- 需要先确认 pgvector 扩展可用
CREATE EXTENSION IF NOT EXISTS vector;

-- Prisma migration 中加一列
ALTER TABLE "KnowledgeCard" ADD COLUMN "embedding" vector(1024);

-- 为余弦相似度检索建 HNSW 索引（320 张卡用 IVFFlat 也够）
CREATE INDEX "KnowledgeCard_embedding_idx" ON "KnowledgeCard"
  USING hnsw (embedding vector_cosine_ops);
```

---

## 2. Embedding 服务配置

### 环境变量

```bash
# .env 新增
KNOWLEDGE_EMBEDDING_API_KEY="sk-your-key-here"
KNOWLEDGE_EMBEDDING_BASE_URL="https://api.siliconflow.cn/v1"
KNOWLEDGE_EMBEDDING_MODEL="BAAI/bge-m3"
KNOWLEDGE_EMBEDDING_DIM=1024
```

### 模块设计：`src/lib/knowledge/embedding.ts`

```typescript
// 职责：单卡 embedding 计算 + 批量向量查询
// 不混入检索逻辑（检索在 retrieval.ts 改造）

export async function embedText(text: string): Promise<number[] | null>;
export async function embedCard(card: { summary: string; body: string; domainTag: string }): Promise<number[] | null>;
```

---

## 3. 保鲜机制

### 写入时（同步）

卡片创建/编辑 → 重新计算 embedding → 写入 embedding 列

**实现位置：** `src/app/api/knowledge/cards/route.ts` 的 POST/PUT handler

**降级策略：** embedding API 超时或失败时：
- 不阻塞卡片保存
- 将 embedding 列设为 null
- 后台任务补算

### 后台刷新（异步兜底）

新建 `src/lib/knowledge/embedding-refresh.ts`：

```typescript
// 定期扫描 embedding IS NULL 的卡片，补算向量
// 可由 API route 触发，或 cron job 调用
export async function refreshNullEmbeddings(batchSize?: number): Promise<{ processed: number; failed: number }>;
```

### Stale 标记（可选，v2 再做）

如果卡片 body 大幅修改（比如超过 50% 内容变化），标记 embedding 为 stale。
当前阶段不做，因为卡片编辑频率低，null 检测够用。

---

## 4. 检索层接入

### 改造 `retrieval.ts`：新增 `retrieveWithEmbedding()`

```typescript
export async function retrieveWithEmbedding(
  question: string,
  limit?: number
): Promise<RetrievalResult[]>;
```

**核心逻辑：**
1. 调 `embedText(question)` 拿到问题向量
2. 用 raw query 查 pgvector：`SELECT *, 1 - (embedding <=> $1) AS similarity FROM "KnowledgeCard" WHERE embedding IS NOT NULL ORDER BY embedding <=> $1 LIMIT $2`
3. 把 pgvector 结果转成 `RetrievalResult[]`，score 用 similarity × 100 映射

### 混合召回入口（Phase 2 做）

当前 Phase 1.5 只定义接口，不改 `ask/route.ts`。

---

## 5. 降级规则

| 场景 | 行为 |
|------|------|
| embedding API 超时 | 主链路退回纯关键词检索，记日志 |
| embedding API 不可用 | 同上，但记 warning |
| 卡片 embedding 为 null | 该卡不参与语义检索，关键词检索不受影响 |
| pgvector 扩展不可用 | 整个语义链路关闭，退回纯关键词 |

---

## 6. 性能预算

| 操作 | 目标延迟 |
|------|----------|
| 单卡 embedding 计算 | < 2s |
| 语义检索（pgvector top20） | < 50ms |
| 混合召回总延迟（关键词+语义+合并） | < 500ms |

---

## 7. 本轮明确不做

- 不改 `ask/route.ts` 主链路（Phase 2 做）
- 不做 stale 标记（v2 再做）
- 不做 HNSW 索引调优（320 张卡不需要）
- 不删除关键词检索
