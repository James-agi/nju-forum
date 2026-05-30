# Feature Specification: NJU 知识库 P0

**Feature Branch**: `001-nju-knowledge-p0`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "根据 D:\nju-forum\docs\PRODUCT-v1.md 生成"

## Clarifications

### Session 2026-05-30

- Q: P0 中“作者”在现有账号体系里如何定义？ → A: P0 作者就是现有 `ADMIN` 角色

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 作者录入可溯源知识卡片 (Priority: P1)

作为作者，我需要把稳定的 NJU 新生入学事务知识拆成小颗粒知识卡片，并为每张卡片记录正文、来源和可信状态，这样知识可以留下来并在后续问答中被准确引用。

**Why this priority**: 没有可溯源的知识卡片，问答和缺口闭环都没有可信数据基础。

**Independent Test**: 作者可以独立创建一张“新生入学稳定知识”卡片，保存后能看到摘要、正文、来源说明、核实状态和更新时间；来源没有链接时，不出现无效跳转。

**Acceptance Scenarios**:

1. **Given** 作者已登录并准备录入一条稳定知识，**When** 作者填写摘要、正文、来源说明、领域标签和核实状态并保存，**Then** 系统保存一张独立知识卡片，并在卡片详情中展示这些信息。
2. **Given** 某条知识来源没有可跳转链接，**When** 作者只填写来源说明并保存，**Then** 系统保留来源说明，且不会向用户展示空链接或无效跳转入口。
3. **Given** 作者发现卡片内容需要修正，**When** 作者更新正文、来源或核实状态，**Then** 系统保存更新内容并刷新更新时间。

---

### User Story 2 - 用户获得有出处的问答结果 (Priority: P1)

作为 NJU 用户，我需要提出具体的信息问题，并只收到基于知识卡片的回答，这样我能知道答案从哪里来，而不是依赖没有出处的泛泛回答。

**Why this priority**: 溯源问答是产品区别于普通聊天工具的核心价值，也是避免错误建议伤害用户的信任红线。

**Independent Test**: 当知识库中有足够相关卡片时，用户的问题会得到带卡片出处的回答；当没有足够依据时，系统明确拒答并记录缺口。

**Acceptance Scenarios**:

1. **Given** 知识库已有能回答“三三制怎么修”的已核实卡片，**When** 用户询问该问题，**Then** 系统给出仅基于相关卡片的回答，并列出每个关键结论对应的卡片出处。
2. **Given** 知识库没有足够依据回答某个 NJU 问题，**When** 用户提交该问题，**Then** 系统明确说明知识库暂无相关内容，并把该问题记录到缺口库。
3. **Given** 用户提出开放域闲聊、教材问答、作业看板或 ToDo 类请求，**When** 该请求不服务于 NJU 信息沉淀，**Then** 系统不把它当作 P0 问答范围处理，并给出边界说明。

---

### User Story 3 - 作者通过缺口库决定补什么 (Priority: P2)

作为作者，我需要看到用户问过但知识库答不出的问题，这样我能优先补充真实需求最高的知识卡片，让产品在冷启动阶段逐步变得更有用。

**Why this priority**: 缺口库把“答不出”转化为后续补卡片的清单，是单作者冷启动可持续运转的关键。

**Independent Test**: 用户触发无依据拒答后，作者可以在缺口库看到问题、时间和处理状态，并能把缺口标记为已处理。

**Acceptance Scenarios**:

1. **Given** 用户问题没有足够卡片依据，**When** 系统拒答，**Then** 缺口库新增一条待处理问题，并保留问题原文和创建时间。
2. **Given** 作者查看缺口库，**When** 作者按待处理状态浏览问题，**Then** 系统展示尚未补卡片的问题列表，帮助作者判断下一步录入内容。
3. **Given** 作者已针对某个缺口补充了知识卡片，**When** 作者把缺口标记为已处理，**Then** 系统保存处理状态，避免重复处理。

### Edge Cases

- 当用户问题同时可能命中多张不相关卡片时，系统不得拼接出削弱可解释性的混源答案。
- 当不同卡片存在明显冲突时，系统必须避免给出确定性结论，并应提示依据不足或需要作者核实。
- 当卡片核实状态为未核实时，用户可见结果必须能区分它与已核实或官方来源内容。
- 当用户重复提交同一类无命中问题时，缺口库应避免把重复问题伪装成大量独立需求。
- 当非作者用户尝试录入、修改卡片或处理缺口时，系统必须阻止该操作。
- 当内容属于强时效安排，例如今年具体报到时间或活动日期，P0 不应要求系统承诺长期准确性。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow the author to create, view, update, and review knowledge cards.
- **FR-002**: Each knowledge card MUST represent one independent knowledge point rather than a broad article.
- **FR-003**: Each knowledge card MUST include summary, body, source description, domain tag, verification status, created time, and updated time.
- **FR-004**: Each knowledge card MAY include a source link; when the link is absent, the system MUST still preserve the source description and MUST NOT show a broken jump action.
- **FR-005**: System MUST distinguish verified content, unverified content, and senior-sourced content wherever answer trust is shown.
- **FR-006**: System MUST allow logged-in users to submit specific NJU information questions.
- **FR-007**: System MUST answer only when sufficient relevant knowledge cards support the answer.
- **FR-008**: Every substantive answer claim MUST cite the supporting card or cards.
- **FR-009**: System MUST NOT use general background knowledge to fill gaps when the knowledge base lacks sufficient support.
- **FR-010**: When no sufficient support exists, system MUST clearly tell the user that the knowledge base has no relevant content and MUST record the question as a gap.
- **FR-011**: System MUST provide the author with a gap library that lists unanswered questions, creation time, and handling status.
- **FR-012**: System MUST allow the author to mark a gap as handled after adding or updating relevant knowledge.
- **FR-013**: P0 MUST include only author-managed card entry, sourced Q&A, gap library, and user login.
- **FR-014**: P0 MUST NOT require forum posting, user-generated contribution workflows, automatic gap-answer push, Wiki browsing, personalized memory, payment, commercialization, textbook Q&A, homework boards, or ToDo planning.
- **FR-015**: P0 content MUST focus on stable freshman-entry knowledge, including rules, processes, and department structure.
- **FR-016**: System MUST treat the existing `ADMIN` role as the P0 author role for knowledge card and gap management.
- **FR-017**: System MUST prevent non-`ADMIN` users from creating, editing, or processing knowledge cards and gaps.

### Key Entities *(include if feature involves data)*

- **Knowledge Card**: A small-grained NJU knowledge point with summary, body, source description, optional source link, domain tag, verification status, created time, and updated time.
- **Question**: A user-submitted NJU information request that can either be answered from cards or recorded as a gap.
- **Gap**: An unanswered question preserved for author review, including original question text, creation time, and handling status.
- **User**: A logged-in person who can ask questions; users with the existing `ADMIN` role are the P0 authors who can additionally manage cards and gaps.
- **Citation**: A visible reference from an answer claim back to the supporting knowledge card and its source metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The author can create a complete knowledge card with source information in under 3 minutes during a manual usability test.
- **SC-002**: 100% of generated answers in the test set include at least one visible citation for each substantive conclusion.
- **SC-003**: 100% of no-support questions in the test set receive an explicit no-content response and create a gap entry.
- **SC-004**: In a 30-question freshman-entry validation set, at least 80% of questions with prepared card coverage are answered with correct cited support.
- **SC-005**: In author trial usage, the author chooses the product over searching chat history for at least 5 real NJU information questions.
- **SC-006**: No P0 acceptance test requires forum posting, voluntary user contribution, automatic push, Wiki browsing, personalized memory, payment, textbook Q&A, homework board, or ToDo behavior.

## Assumptions

- The feature is the P0 version described in `docs/PRODUCT-v1.md`, not the later P1 or P2 roadmap.
- The P0 author is represented by the existing `ADMIN` role; no new `AUTHOR` role is introduced for P0.
- User login already exists as a product foundation and is reused for access control and question attribution.
- Initial content focuses on stable freshman-entry knowledge rather than strongly time-sensitive arrangements.
- Automatic notification after a gap is answered is out of scope for P0.
- Forum and UGC behavior remain future assets and are not part of this feature.
