# 知识问答模块架构

## 目录结构

```
src/lib/knowledge/
├── config.ts               # 集中配置（评分阈值、超时、限流等）
├── llm-client.ts            # 统一 LLM 客户端（chatCompletion / createEmbedding）
├── trace.ts                 # 结构化追踪（KnowledgeTrace + TraceBuilder）
├── cache.ts                 # LRU 内存缓存
├── types.ts                 # 共享类型（DTO、枚举）
├── types-internal.ts        # 内部类型（RetrievalCard, RetrievalResult）
├── lexicon.ts               # 统一词表（STOP/GENERIC/SPEC/ALIAS/NJU_SIGNALS）
├── tokenizer.ts             # jieba 懒加载 + ngram fallback 分词
├── term-extraction.ts       # 检索词提取
├── scoring.ts               # 纯函数评分（scoreCard, isSpec, scTerm）
├── evidence.ts              # 证据充分性评估
├── retrieval.ts             # 检索编排（~60行，协调关键词+语义+RRF融合）
├── embedding.ts             # 嵌入查询（委托 llm-client）
├── vector-store.ts          # 向量存储（pgvector 优先 + JSON 文件降级）
├── embedding-refresh.ts     # 异步 embedding 计算与持久化
├── answer.ts                # 答案构建（LLM 优先 + 确定性降级）
├── query-expansion.ts       # LLM 驱动的搜索词扩展
├── scope.ts                 # P0 范围分类
├── rate-limit.ts            # 令牌桶限速
├── authz.ts                 # 授权
├── validation.ts            # Zod 模式 + 工具函数
├── card-batch/              # 批量制卡子系统
├── __tests__/
│   ├── knowledge.test.ts    # 21 个原有测试
│   ├── llm-client.test.ts   # 9 个测试（Phase 1 新增）
│   ├── scoring.test.ts      # 9 个测试（Phase 2 新增）
│   ├── evidence.test.ts     # 6 个测试（Phase 2 新增）
│   └── term-extraction.test.ts  # 6 个测试（Phase 2 新增）

src/app/api/knowledge/
├── ask/route.ts             # POST 问答主流程
├── ask/debug/route.ts       # ADMIN debug trace 查询
├── cards/route.ts           # POST/GET 知识卡片
├── cards/[id]/route.ts      # GET/PATCH 单张卡片
├── card-batches/            # 批量制卡 API
├── gaps/                    # 知识缺口 CRUD
├── answer-feedback/         # 答案反馈
├── source-images/           # 来源图片导入
├── admin/
│   ├── stats/route.ts       # 统计概览
│   ├── traces/route.ts      # Trace 分页查询
│   └── degradation/route.ts # 降级率按小时聚合
```

## 模块依赖图

```
ask/route.ts (编排层)
  ├── authz.ts / rate-limit.ts / validation.ts
  ├── scope.ts ← lexicon.ts
  ├── query-expansion.ts ← llm-client.ts
  ├── retrieval.ts (编排)
  │     ├── term-extraction.ts ← tokenizer.ts + lexicon.ts
  │     ├── scoring.ts ← config.ts
  │     ├── vector-store.ts (pgvector)
  │     └── embedding.ts ← llm-client.ts
  ├── evidence.ts ← config.ts
  ├── answer.ts ← llm-client.ts
  ├── cache.ts
  └── trace.ts
```

## 问答流程

1. **认证** → `allowKnowledgeGuest()`（游客可问，仅阻止封禁用户）
2. **限速** → `checkRateLimit()`（令牌桶，用户 20/min，访客 5/min）
3. **输入校验** → Zod `askRequestSchema`（2~500 字符）
4. **范围分类** → `classifyP0Scope()`（9 类非目标请求关键词过滤 + NJU 信号词白名单）
5. **查询扩展** → `expandQueryTerms()`（LLM 生成同义词/别名，≤5 个，静默失败）
6. **混合检索** → `retrieveHybrid()`（关键词 ILIKE + 语义 pgvector 余弦相似度，RRF 融合 k=60）
7. **证据评估** → `evaluateEvidence()`（评分阈值≥12、强术语锚点≥2 个 ≥4 字符、验证状态）
8. **答案生成** → `buildCardBoundedAnswer()`（LLM 优先 15s 超时，失败降级确定性模板）
9. **持久化** → 创建 `KnowledgeQuestion` + 可选 `KnowledgeAnswer` / `KnowledgeGap`
10. **追踪** → `TraceBuilder` 全程埋点，存入 `question.trace` JSON

## 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `KNOWLEDGE_LLM_API_KEY` | LLM API Key | 回退 `OPENAI_API_KEY` |
| `KNOWLEDGE_LLM_MODEL` | LLM 模型 | 必填 |
| `KNOWLEDGE_LLM_BASE_URL` | LLM API 地址 | → `OPENAI_BASE_URL` → `https://api.openai.com/v1` |
| `KNOWLEDGE_EMBEDDING_API_KEY` | Embedding API Key | → `KNOWLEDGE_LLM_API_KEY` → `OPENAI_API_KEY` |
| `KNOWLEDGE_EMBEDDING_MODEL` | Embedding 模型 | `bge-m3` |
| `KNOWLEDGE_EMBEDDING_BASE_URL` | Embedding API 地址 | → `KNOWLEDGE_LLM_BASE_URL` → `OPENAI_BASE_URL` |

## 配置常量（config.ts）

| 常量 | 值 | 用途 |
|------|-----|------|
| `MIN_SUFFICIENT_SCORE` | 12 | 证据充分最低分 |
| `MIN_STRONG_TERM_COUNT` | 2 | 强术语最低数量 |
| `MIN_SINGLE_ANCHOR_SCORE` | 16 | 单锚点最低分 |
| `RRF_K` | 60 | 倒数排名融合常数 |
| `LLM_ANSWER_TIMEOUT` | 15s | LLM 回答超时 |
| `EMBEDDING_TIMEOUT` | 5s | Embedding 超时 |
| `CACHE_TTL_MS` | 1h | 答案缓存 TTL |

## 重构历史

- **Phase 1**（2026-07-05）：LLM 客户端统一 + 配置外部化 + Trace 结构化 + Prompt 防护
- **Phase 2**（2026-07-05）：retrieval.ts 拆分为 5 个子模块 + 词表统一 + re-export 兼容
- **Phase 3**（2026-07-05）：向量存储文件→pgvector + 异步 embedding 保鲜 + LRU 缓存
- **Phase 4**（2026-07-05）：评估体系恒真修复 + ADMIN 观测 API + 文档清理
