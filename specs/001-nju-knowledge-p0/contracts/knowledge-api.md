# Contract: NJU 知识库 P0 API

This contract describes the P0 application-facing route behavior. Exact file
paths may follow the existing Next.js App Router convention under
`src/app/api/knowledge`.

## Shared Rules

- Authenticated users may ask questions.
- Only the author/admin role may create, update, archive, or review knowledge
  cards and gaps.
- Every successful answer must include citations to knowledge cards.
- No response path may use general LLM knowledge as a fallback.
- If evidence is insufficient, the response must be a no-content result and must
  create a gap.
- Error responses follow the existing project pattern:

```json
{ "error": "用户可读错误信息" }
```

## Knowledge Card Endpoints

### GET /api/knowledge/cards

Purpose: list cards for author management and internal retrieval previews.

Query parameters:
- `q` optional text query.
- `domainTag` optional domain filter.
- `verificationStatus` optional trust filter.
- `page` optional page number, default `1`.

Response `200`:

```json
{
  "cards": [
    {
      "id": "card_id",
      "summary": "三三制选课规则摘要",
      "body": "完整知识内容",
      "sourceUrl": "https://example.nju.edu.cn/rule",
      "sourceDescription": "南京大学某官方说明页",
      "sourceType": "OFFICIAL",
      "verificationStatus": "VERIFIED",
      "domainTag": "新生入学",
      "createdAt": "2026-05-30T00:00:00.000Z",
      "updatedAt": "2026-05-30T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### POST /api/knowledge/cards

Purpose: author creates one card.

Authorization: author/admin only.

Request:

```json
{
  "summary": "三三制怎么修",
  "body": "完整知识内容",
  "sourceUrl": "https://example.nju.edu.cn/rule",
  "sourceDescription": "南京大学某官方说明页",
  "sourceType": "OFFICIAL",
  "verificationStatus": "VERIFIED",
  "domainTag": "新生入学"
}
```

Response `200`: created card object.

Validation:
- `summary`, `body`, `sourceDescription`, `sourceType`,
  `verificationStatus`, and `domainTag` are required.
- `sourceUrl` is optional; empty `sourceUrl` must not create a broken jump action.

### GET /api/knowledge/cards/{id}

Purpose: fetch one card.

Response `200`: card object.

Response `404`: card does not exist or is archived for normal viewing.

### PATCH /api/knowledge/cards/{id}

Purpose: author updates card fields or archives a stale card.

Authorization: author/admin only.

Request: any mutable subset of card fields, plus optional `archive` boolean.

Response `200`: updated card object.

## Question Endpoint

### POST /api/knowledge/ask

Purpose: user asks a specific NJU information question.

Authorization: authenticated user.

Request:

```json
{
  "question": "三三制怎么修？"
}
```

Response `200` when answered:

```json
{
  "status": "ANSWERED",
  "questionId": "question_id",
  "answer": "根据已收录卡片，三三制的关键规则是……",
  "citations": [
    {
      "cardId": "card_id",
      "summary": "三三制怎么修",
      "sourceDescription": "南京大学某官方说明页",
      "sourceUrl": "https://example.nju.edu.cn/rule",
      "sourceType": "OFFICIAL",
      "verificationStatus": "VERIFIED",
      "claimText": "三三制的关键规则是……"
    }
  ]
}
```

Response `200` when no sufficient basis exists:

```json
{
  "status": "GAP_RECORDED",
  "questionId": "question_id",
  "gapId": "gap_id",
  "message": "知识库里没有相关内容，这个问题已经记下了。"
}
```

Response `200` when outside P0 scope:

```json
{
  "status": "OUT_OF_SCOPE",
  "questionId": "question_id",
  "message": "这个请求不属于 P0 的 NJU 信息沉淀范围。"
}
```

Validation:
- `question` is required and must not be blank.
- Answered responses must have at least one citation.
- No response may include uncited substantive claims.

## Gap Endpoints

### GET /api/knowledge/gaps

Purpose: author reviews unanswered questions.

Authorization: author/admin only.

Query parameters:
- `status` optional gap status, default open gaps first.
- `page` optional page number, default `1`.

Response `200`:

```json
{
  "gaps": [
    {
      "id": "gap_id",
      "originalQuestion": "某问题",
      "status": "OPEN",
      "linkedCardId": null,
      "duplicateOfId": null,
      "createdAt": "2026-05-30T00:00:00.000Z",
      "updatedAt": "2026-05-30T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### PATCH /api/knowledge/gaps/{id}

Purpose: author marks a gap as handled, duplicate, or out of scope.

Authorization: author/admin only.

Request:

```json
{
  "status": "HANDLED",
  "linkedCardId": "card_id"
}
```

Response `200`: updated gap object.

Validation:
- `HANDLED` should include a `linkedCardId` when a card resolved the gap.
- `DUPLICATE` should include a `duplicateOfId`.
- This endpoint must not trigger automatic user push in P0.
