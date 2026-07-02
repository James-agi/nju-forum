# 知识问答回归评测流程

## 何时触发回归

以下改动必须跑一轮评测：

- 修改作答 prompt（`src/lib/knowledge/answer.ts`）
- 修改追问判断（`src/lib/knowledge/followup-detection.ts`）
- 修改查询扩展（`src/lib/knowledge/query-expansion.ts`）
- 修改检索逻辑（`src/lib/knowledge/retrieval.ts`、`rerank.ts`）
- 修改范围判断（`src/lib/knowledge/scope.ts`）
- 修改初筛逻辑（`evaluateEvidence`）
- 大批量入库新卡片后（可能影响检索排序）

## 操作命令

```bash
# 批量评测（15 条，约 2 分钟）
npx tsx scripts/ask-eval.ts --dataset scripts/knowledge-eval-dataset.json

# 单题调试（修改脚本中的问题）
npx tsx scripts/ask-eval.ts

# 导出用户反馈候选用例
npx tsx scripts/export-feedback-cases.ts --out scripts/feedback-cases-raw.json

# Debug trace（需管理员登录，浏览器 Network 面板查看）
# 请求 /api/knowledge/ask?debug=1，响应中包含 debug 字段
```

## 结果判读

| 结果 | 含义 | 操作 |
|------|------|------|
| ✅ PASS | 自动检查通过（expectedStatus / mustMention / mustCiteCardIds） | 无需处理 |
| ❌ FAIL | 自动检查失败 | 必须修复或解释原因 |
| 🔍 MANUAL | 无自动检查项，需人工判断 | 读答案摘要，判断是否符合 expectation |

## 基线结果（2026-06-24）

```
总计: 15 条
  ✅ PASS: 12
  ❌ FAIL: 1  [oos-1] 天气问题未被 classifyP0Scope 拦截
  🔍 MANUAL: 2  [fact-2] 三三制（数据缺失） [followup-2] 成绩要求（上下文依赖）
```

## 失败定位流程

1. 看 FAIL 的具体原因（`expectedStatus` / `mustMention` / `mustCiteCardIds` 哪个没过）
2. 如果是 `mustMention` 失败 → 答案没提到关键概念，可能是检索没命中或 LLM 漏引用
3. 如果是 `expectedStatus` 失败 → 范围判断逻辑需调整（如 oos-1）
4. 如果是答案质量差但自动检查通过 → 补充 `mustMention` 约束或加新的自动检查字段
5. 需要更细粒度定位时，用 `?debug=1` 查看 API 中间产物

## 评测集维护

- 评测集位置：`scripts/knowledge-eval-dataset.json`
- 从线上反馈补充：先运行 `export-feedback-cases.ts`，人工筛选后并入
- 新增用例必须有：`id`、`question`、`scenario`、`expectation`
- 建议至少 50% 的用例有自动检查字段（`expectedStatus` 或 `mustMention`）
