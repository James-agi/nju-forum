# Implementation Plan: NJU 知识库 P0

**Branch**: `001-nju-knowledge-p0` | **Date**: 2026-05-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-nju-knowledge-p0/spec.md`

**Product Source**: [docs/PRODUCT-v1.md](../../docs/PRODUCT-v1.md)

## Summary

Build the P0 NJU knowledge base around four scoped capabilities: author-managed
knowledge card entry, source-grounded Q&A, gap library, and existing login reuse.
Implementation stays inside the current Next.js app, adds knowledge-specific
Prisma models instead of repurposing forum tables, and keeps answer generation
strictly card-bounded. When retrieval has no sufficient card basis, the product
must refuse and create a gap rather than using general model knowledge.

## Technical Context

**Language/Version**: TypeScript 5, React 18, Next.js 14.2 App Router

**Primary Dependencies**: Next.js, NextAuth v5 beta, Prisma 6, PostgreSQL,
Zod, Tailwind CSS, existing shadcn-style UI components, server-side `fetch` for
OpenAI-compatible answer generation

**Storage**: Existing PostgreSQL datasource via Prisma; add knowledge-specific
tables and leave current forum tables as future P2 assets

**Testing**: No dedicated test runner is configured. Use `npm run lint`,
`npm run build`, focused manual acceptance flows from quickstart, and add tests
only if later tasks introduce a test runner explicitly.

**Target Platform**: Web application running in the existing Next.js deployment

**Project Type**: Full-stack web app with server route handlers and React UI

**Performance Goals**: Card CRUD and gap list interactions feel immediate for
author use; Q&A should return an answer or no-hit response within 10 seconds for
the P0 validation set.

**Constraints**: Must reuse NextAuth and PostgreSQL; must not scrape platforms,
simulate university login, collect private academic data, use forum/UGC behavior
for P0, or fall back to general LLM knowledge.

**Scale/Scope**: P0 single-author cold start; stable freshman-entry content;
manual validation with a 30-question prepared set.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| Check | Result | Evidence |
|-------|--------|----------|
| Product boundary | PASS | Feature improves all three sedimentation outcomes: cards leave knowledge behind, search/Q&A helps it be found, citations preserve source. |
| Source grounding | PASS | Plan requires card citations, explicit no-hit refusal, and gap creation. |
| No general fallback | PASS | Research chooses card-bounded answer generation only; unsupported questions become gaps. |
| Knowledge-card foundation | PASS | Data model preserves card granularity, source URL, source description, verification, created time, and updated time. |
| Trust visibility | PASS | Model separates source type and verification status for UI and answer behavior. |
| Phase boundary | PASS | P1/P2 features remain excluded: automatic push, Wiki browsing, UGC/forum contribution, personalized memory, time-sensitive data, payment, commercialization. |
| Authentication reuse | PASS | Existing NextAuth session and `ADMIN` role are reused for author controls. |
| Storage reuse | PASS | Existing PostgreSQL and Prisma are reused; pgvector is deferred as optional later optimization. |
| Data safety | PASS | Content enters through author entry or explicit user questions; no scraping or private academic data collection. |
| Forum boundary | PASS | Current forum tables stay untouched for P0 except shared `User` identity relation. |
| P0 scope | PASS | Planned capabilities are card entry, sourced Q&A, gap library, and login. |
| Time box | PASS | P0 uses simple card CRUD, text retrieval, and manual author curation to fit the half-month scope. |

### Post-Design Gate

| Check | Result | Evidence |
|-------|--------|----------|
| Product boundary | PASS | `data-model.md` and contracts center on KnowledgeCard, question answering, and gaps. |
| Source grounding | PASS | `contracts/knowledge-api.md` requires citations for answered responses and gap creation for no-hit responses. |
| No general fallback | PASS | Answer contract has no "general answer" response path. |
| Knowledge-card foundation | PASS | `data-model.md` defines required card fields and validation rules. |
| Trust visibility | PASS | `SourceType` and `VerificationStatus` are explicit model fields and response fields. |
| Phase boundary | PASS | Quickstart and contracts exclude forum posting, automatic push, Wiki browsing, and memory. |
| Authentication reuse | PASS | Contracts use existing authenticated sessions and admin/author authorization. |
| Storage reuse | PASS | Data model adds Prisma models under the existing PostgreSQL datasource. |
| Data safety | PASS | No platform scraping or simulated university login is part of any artifact. |
| Forum boundary | PASS | Forum data is not used for P0 knowledge behavior. |
| P0 scope | PASS | Artifacts cover only P0 capabilities. |
| Time box | PASS | Research explicitly rejects broad knowledge graph and semantic retrieval as P0 requirements. |

## Project Structure

### Documentation (this feature)

```text
specs/001-nju-knowledge-p0/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── knowledge-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
prisma/
└── schema.prisma          # Add knowledge models; keep forum models as P2 assets

src/
├── app/
│   ├── knowledge/
│   │   └── page.tsx       # User Q&A surface
│   ├── admin/
│   │   ├── knowledge/
│   │   │   └── page.tsx   # Author card management
│   │   └── gaps/
│   │       └── page.tsx   # Author gap library
│   └── api/
│       └── knowledge/
│           ├── ask/route.ts
│           ├── cards/route.ts
│           ├── cards/[id]/route.ts
│           ├── gaps/route.ts
│           └── gaps/[id]/route.ts
├── components/
│   └── knowledge/
│       ├── card-editor.tsx
│       ├── card-list.tsx
│       ├── gap-list.tsx
│       └── question-box.tsx
└── lib/
    └── knowledge/
        ├── answer.ts      # Card-bounded answer orchestration
        ├── retrieval.ts   # P0 card retrieval and sufficiency checks
        ├── validation.ts  # Zod schemas and boundary checks
        └── types.ts
```

**Structure Decision**: Use the existing single Next.js app. Keep P0 knowledge
features under `src/app/knowledge`, `src/app/admin/*`, `src/app/api/knowledge`,
and `src/lib/knowledge`. This avoids a second app, avoids new identity
infrastructure, and keeps current forum routes isolated for future P2 use.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
