# Quickstart: NJU 知识库 P0

This quickstart validates the P0 plan after implementation. It assumes the
existing project setup remains unchanged and no P1/P2 behavior is required.

## Prerequisites

- Existing project dependencies are installed.
- PostgreSQL is available through the existing `DATABASE_URL`.
- Existing NextAuth configuration is available.
- At least one admin/author user exists.
- Optional answer generation config uses the product-approved
  OpenAI-compatible server-side settings if the implementation enables generated
  answers. Unsupported or unconfigured generation must not fall back to general
  knowledge.

## Local Verification Commands

Run these after implementation:

```bash
npm run db:generate
npm run lint
npm run build
npm run smoke:p0
```

Run database migration/push only when the implementation step explicitly calls
for applying schema changes to the local database:

```bash
npm run db:migrate
```

Ensure the local forum default sections exist before browser verification:

```bash
npm run db:seed:sections
```

## Implementation Verification Notes

2026-05-30 implementation status:

- `npm.cmd run db:generate`: passed. Prisma Client was generated from the updated schema.
- `npm.cmd run lint`: passed with no ESLint warnings or errors.
- `npm.cmd run build`: passed with exit code 0. The build still logs existing dynamic-route/database warnings from pre-existing `/api/user/*` and `/api/sections` routes when the local database is unavailable; no new knowledge API build error remains after marking the knowledge API routes dynamic.
- `npm.cmd run db:migrate -- --name nju_knowledge_p0`: passed after the user confirmed database changes. Migration `20260530043857_nju_knowledge_p0` was created and applied to local PostgreSQL database `nju_forum_dev`.
- Manual flows below are ready to run after starting the local Next.js dev server.
- Local dev server was started at `http://localhost:3000`.
- Local API/session validation passed for the core quickstart paths:
  - Admin/auth reuse works with an `ADMIN` test account.
  - Card creation works for a card with a source URL.
  - Card creation works for a card without a source URL; API stores `sourceUrl` as `null`.
  - Covered question returns `ANSWERED` with one visible citation payload.
  - Uncovered question returns `GAP_RECORDED`.
  - P0 non-goal request returns `OUT_OF_SCOPE`.
  - Gap handling works by linking a resolving card and marking the gap `HANDLED`.
- Browser visual verification is still pending because this session has no browser-control tool; use the manual acceptance flow below to inspect the UI rendering.

2026-05-30 follow-up verification:

- `npm.cmd run db:seed:sections`: passed. The local database contains the default forum sections `学习`, `生活`, `二手`, `求助`, and `吐槽`.
- `npm.cmd run smoke:p0`: passed. The smoke script checks default sections in the database, `/api/sections`, `/forum`, `/forum/new`, one section page, conservative retrieval sufficiency, weak-evidence rejection, and P0 forum/UGC scope rejection.
- `npm.cmd run lint`: passed after the forum UI follow-up.
- `npx.cmd tsc --noEmit`: passed after the forum UI follow-up.
- The local dev server was restarted after a `.next` cache mismatch caused by running `next build` while `next dev` was active. When validating with `next build` during an active dev session, restart `next dev` afterward before browser testing.
- Forum UI follow-up covered `/forum`, `/forum/section/[id]`, and `/forum/new`; all three routes returned HTTP 200 from the local dev server. Final visual acceptance remains user-driven in the browser.
- User browser acceptance feedback: current forum, posting, knowledge Q&A, and admin knowledge workflows are acceptable for this P0 pass. Remaining UI polish can continue as follow-up work outside P0 acceptance.

## Contract Review Notes

The implemented P0 routes match `contracts/knowledge-api.md` at code-review level:

- Card endpoints exist under `/api/knowledge/cards` and `/api/knowledge/cards/[id]`.
- Ask endpoint exists under `/api/knowledge/ask` and persists questions, answers, citations, and no-hit gaps.
- Gap endpoints exist under `/api/knowledge/gaps` and `/api/knowledge/gaps/[id]`.
- Author-only card and gap management reuses the existing `ADMIN` role.
- Answer generation is card-bounded. Missing LLM config or LLM failure falls back only to deterministic card snippets, never to general knowledge.
- No-hit questions return `GAP_RECORDED` and create or reuse a gap by `normalizedQuestion`.
- P0 non-goal requests return `OUT_OF_SCOPE` and do not create cited answers.
- Source URL remains optional; source description is required and displayed without a broken jump action.

## P0 Boundary Confirmation

The implementation does not depend on or introduce these excluded P0 capabilities:

- Forum posting or UGC contribution.
- Automatic "your answer is ready" push.
- Wiki browsing mode.
- Personalized agent memory.
- Time-sensitive activity or deadline data as a committed answer source.
- Textbook Q&A, homework board, or ToDo planning.
- Payment, membership, or commercialization.

## Manual Acceptance Flow

### 1. Author creates a verified official card

1. Sign in as the author/admin.
2. Open the author knowledge card management page.
3. Create a card for a stable freshman-entry topic.
4. Fill summary, body, source description, source URL, source type, verification
   status, and domain tag.
5. Confirm the card appears in the list and detail view.

Expected result: the card has separate source URL and source description, shows
verification state, and has created/updated timestamps.

### 2. Author creates a card without a source URL

1. Create a senior-sourced card where the source is a textual description only.
2. Save the card.
3. Open the card detail view.

Expected result: source description remains visible and no broken jump action is
shown.

### 3. User asks a covered NJU question

1. Sign in as a normal user.
2. Ask a question that is covered by the prepared card set.
3. Review the answer.

Expected result: the answer only uses card-backed claims and every substantive
claim has visible card/source citation data.

### 4. User asks an uncovered NJU question

1. Ask a specific NJU information question with no prepared card coverage.
2. Review the response.
3. Sign in as the author/admin and open the gap library.

Expected result: the user receives an explicit no-content response, and the gap
library contains the question with `OPEN` status.

### 5. Author handles a gap

1. Add or update a card that answers an open gap.
2. Mark the gap as handled and link the resolving card if supported.

Expected result: the gap status changes to `HANDLED`. No automatic push or
notification is required for P0.

### 6. P0 boundary check

Submit or inspect tasks for these requests:

- Forum posting or UGC contribution.
- Automatic "your answer is ready" push.
- Wiki browsing mode.
- Personalized agent memory.
- Textbook Q&A, homework board, or ToDo planning.
- Payment or commercialization.

Expected result: none of these are required for P0 acceptance. They remain out of
scope or later roadmap items.

## Validation Set

Prepare 30 stable freshman-entry questions before final P0 acceptance:

- At least 24 should have prepared card coverage.
- All covered questions should return card-cited answers.
- All uncovered questions should create gaps instead of general answers.
- The author should use the product for at least 5 real NJU information questions
  instead of searching chat history.
