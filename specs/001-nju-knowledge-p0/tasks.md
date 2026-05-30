# Tasks: NJU 知识库 P0

**Input**: Design documents from `specs/001-nju-knowledge-p0/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/knowledge-api.md](./contracts/knowledge-api.md), [quickstart.md](./quickstart.md)

**Tests**: No dedicated automated test framework is configured and the feature spec does not request TDD. Verification tasks use existing `npm run lint`, `npm run build`, and the manual quickstart flows.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task touches different files and does not depend on an incomplete task.
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`).
- Every task includes an exact file path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the P0 knowledge feature file structure without adding dependencies or changing templates.

- [x] T001 Create knowledge route directories in `src/app/knowledge/`, `src/app/admin/knowledge/`, `src/app/admin/gaps/`, and `src/app/api/knowledge/`
- [x] T002 Create knowledge component directory in `src/components/knowledge/`
- [x] T003 Create knowledge library directory in `src/lib/knowledge/`
- [x] T004 [P] Create placeholder module file `src/lib/knowledge/types.ts`
- [x] T005 [P] Create placeholder validation module file `src/lib/knowledge/validation.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define shared schema, validation, authorization, retrieval, and answer boundaries required by all user stories.

**CRITICAL**: No user story implementation should begin until this phase is complete.

- [x] T006 Add `SourceType`, `VerificationStatus`, `QuestionStatus`, and `GapStatus` enums to `prisma/schema.prisma`
- [x] T007 Add `KnowledgeCard`, `KnowledgeQuestion`, `KnowledgeAnswer`, `KnowledgeCitation`, and `KnowledgeGap` models with relationships to `User` in `prisma/schema.prisma`
- [x] T008 Update `User` relations for created/updated cards, submitted questions, and handled gaps in `prisma/schema.prisma`
- [x] T009 Define shared TypeScript enums and response types matching the Prisma model in `src/lib/knowledge/types.ts`
- [x] T010 Define Zod schemas for card create/update, ask request, and gap update payloads in `src/lib/knowledge/validation.ts`
- [x] T011 Implement author/admin guard helpers for route handlers in `src/lib/knowledge/authz.ts`
- [x] T012 Implement P0 scope classification helpers for open-domain, textbook, homework, ToDo, forum, UGC, payment, Wiki, memory, and push requests in `src/lib/knowledge/scope.ts`
- [x] T013 Implement conservative card retrieval over summary, body, domain tag, archive status, and verification fields in `src/lib/knowledge/retrieval.ts`
- [x] T014 Implement citation sufficiency rules that reject empty, archived, unrelated, or conflicting evidence in `src/lib/knowledge/retrieval.ts`
- [x] T015 Implement card-bounded answer orchestration with no general-knowledge fallback in `src/lib/knowledge/answer.ts`

**Checkpoint**: Shared data model and service boundaries are ready; story work can begin.

---

## Phase 3: User Story 1 - 作者录入可溯源知识卡片 (Priority: P1) MVP

**Goal**: The author can create, view, update, and archive small-grained knowledge cards with source and trust metadata.

**Independent Test**: Sign in as admin, create a verified official card, create a senior-sourced card without URL, update a card, and confirm source description, trust state, and timestamps are visible without broken jump actions.

### Implementation for User Story 1

- [x] T016 [US1] Implement `GET` and `POST /api/knowledge/cards` handlers in `src/app/api/knowledge/cards/route.ts`
- [x] T017 [US1] Implement `GET` and `PATCH /api/knowledge/cards/{id}` handlers in `src/app/api/knowledge/cards/[id]/route.ts`
- [x] T018 [US1] Create reusable card editor form with required source and trust fields in `src/components/knowledge/card-editor.tsx`
- [x] T019 [P] [US1] Create reusable card list/detail component with source URL fallback behavior in `src/components/knowledge/card-list.tsx`
- [x] T020 [US1] Implement author card management page in `src/app/admin/knowledge/page.tsx`
- [x] T021 [US1] Add UI handling that hides jump actions when `sourceUrl` is empty in `src/components/knowledge/card-list.tsx`
- [x] T022 [US1] Add admin navigation entry for knowledge card management in `src/components/layout/navbar.tsx`
- [x] T023 [US1] Manually verify quickstart flows 1 and 2 and record any findings in `specs/001-nju-knowledge-p0/quickstart.md`

**Checkpoint**: User Story 1 is independently usable by the author and satisfies card-entry requirements.

---

## Phase 4: User Story 2 - 用户获得有出处的问答结果 (Priority: P1)

**Goal**: A logged-in user can ask a specific NJU information question and receive either a cited card-grounded answer, a no-content gap response, or a clear out-of-scope response.

**Independent Test**: Ask one covered freshman-entry question, one uncovered NJU question, and one P0 non-goal request; confirm the three response paths match the contract.

### Implementation for User Story 2

- [x] T024 [US2] Implement `POST /api/knowledge/ask` question handling in `src/app/api/knowledge/ask/route.ts`
- [x] T025 [US2] Persist submitted questions, answered outcomes, answers, and citations in `src/app/api/knowledge/ask/route.ts`
- [x] T026 [US2] Create user question box component with loading, answered, no-hit, and out-of-scope states in `src/components/knowledge/question-box.tsx`
- [x] T027 [US2] Create citation display UI showing card summary, source description, optional source URL, source type, and verification status in `src/components/knowledge/question-box.tsx`
- [x] T028 [US2] Implement user Q&A page in `src/app/knowledge/page.tsx`
- [x] T029 [US2] Add authenticated navigation entry for the knowledge Q&A page in `src/components/layout/navbar.tsx`
- [x] T030 [US2] Add no-hit gap creation path that returns `GAP_RECORDED` without generating an unsupported answer in `src/app/api/knowledge/ask/route.ts`
- [x] T031 [US2] Add duplicate gap detection by `normalizedQuestion` before creating a new gap in `src/app/api/knowledge/ask/route.ts`
- [x] T032 [US2] Add answer-generation config and failure handling that never falls back to general LLM knowledge in `src/lib/knowledge/answer.ts`
- [x] T033 [US2] Add out-of-scope handling for P0 non-goals without creating cited answers in `src/app/api/knowledge/ask/route.ts`
- [x] T034 [US2] Manually verify quickstart flows 3, 4, and 6 and record any findings in `specs/001-nju-knowledge-p0/quickstart.md`

**Checkpoint**: User Story 2 works independently once seed cards exist and preserves source-grounding rules.

---

## Phase 5: User Story 3 - 作者通过缺口库决定补什么 (Priority: P2)

**Goal**: The author can review unanswered questions, identify duplicates or out-of-scope items, and mark gaps as handled after adding relevant cards.

**Independent Test**: Trigger an uncovered question as a user, open the gap library as admin, mark the gap handled with a linked card, and confirm no automatic push is required.

### Implementation for User Story 3

- [x] T035 [US3] Implement `GET /api/knowledge/gaps` handler with status filter and pagination in `src/app/api/knowledge/gaps/route.ts`
- [x] T036 [US3] Implement `PATCH /api/knowledge/gaps/{id}` handler for `HANDLED`, `DUPLICATE`, and `OUT_OF_SCOPE` transitions in `src/app/api/knowledge/gaps/[id]/route.ts`
- [x] T037 [P] [US3] Create reusable gap list component with status filters and linked-card display in `src/components/knowledge/gap-list.tsx`
- [x] T038 [US3] Implement author gap library page in `src/app/admin/gaps/page.tsx`
- [x] T039 [US3] Add admin navigation entry for gap library in `src/components/layout/navbar.tsx`
- [x] T040 [US3] Manually verify quickstart flow 5 and record any findings in `specs/001-nju-knowledge-p0/quickstart.md`

**Checkpoint**: User Story 3 is independently usable for author gap review after User Story 2 can create gaps.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify P0 boundaries, generated client state, build health, and final acceptance readiness.

- [x] T041 Run Prisma client generation for the updated schema using `package.json` script `db:generate`
- [x] T042 Confirm with the user before applying schema changes to a local database with `package.json` script `db:migrate`
- [x] T043 Run lint validation using `package.json` script `lint`
- [x] T044 Run production build validation using `package.json` script `build`
- [x] T045 Review implemented behavior against `specs/001-nju-knowledge-p0/contracts/knowledge-api.md`
- [x] T046 Execute the full manual quickstart in `specs/001-nju-knowledge-p0/quickstart.md`
- [x] T047 Prepare a 30-question freshman-entry validation checklist in `specs/001-nju-knowledge-p0/validation-set.md`
- [x] T048 Confirm no P0 implementation depends on forum posting, UGC contribution, automatic push, Wiki browsing, personalized memory, payment, textbook Q&A, homework board, or ToDo behavior in `specs/001-nju-knowledge-p0/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; provides author card data needed for strong US2 validation.
- **User Story 2 (Phase 4)**: Depends on Foundational; can begin after retrieval/answer foundations, but full supported-answer validation benefits from US1.
- **User Story 3 (Phase 5)**: Depends on US2 for generated gaps; can build UI/API after Foundational.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 - 作者录入可溯源知识卡片**: MVP scope and first usable increment.
- **US2 - 用户获得有出处的问答结果**: Requires knowledge-card model and retrieval; uses cards created through US1 for supported-answer validation.
- **US3 - 作者通过缺口库决定补什么**: Requires gap records created through US2.

### Within Each User Story

- Route validation and data persistence before UI integration.
- Reusable components before page composition.
- Manual quickstart verification after the story UI and route handlers are complete.

## Parallel Opportunities

- T004 and T005 can run in parallel.
- T018 and T019 can run in parallel after US1 routes are defined.
- T037 can run in parallel with T036 after the gap contract is stable.
- US1 UI components and US2 question UI can be developed in parallel after Phase 2 if separate files are assigned, but integrated validation should remain sequential.

## Parallel Example: User Story 1

```text
Task: "T018 [US1] Create reusable card editor form with required source and trust fields in src/components/knowledge/card-editor.tsx"
Task: "T019 [P] [US1] Create reusable card list/detail component with source URL fallback behavior in src/components/knowledge/card-list.tsx"
```

## Parallel Example: User Story 3

```text
Task: "T036 [US3] Implement PATCH /api/knowledge/gaps/{id} handler for HANDLED, DUPLICATE, and OUT_OF_SCOPE transitions in src/app/api/knowledge/gaps/[id]/route.ts"
Task: "T037 [P] [US3] Create reusable gap list component with status filters and linked-card display in src/components/knowledge/gap-list.tsx"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 so the author can seed real cards.
3. Stop and validate card creation, source separation, and trust visibility.

### Incremental Delivery

1. Add US1 for author card entry.
2. Add US2 for user Q&A with citations, no-hit gaps, and out-of-scope handling.
3. Add US3 for author gap review and handling.
4. Run Phase 6 validation.

### Boundary Discipline

- Do not add forum/UGC contribution tasks to P0.
- Do not add automatic push tasks to P0.
- Do not add Wiki browsing or personalized memory tasks to P0.
- Do not add dependency installation tasks unless separately approved.
