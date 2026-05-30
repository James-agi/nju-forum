<!--
Sync Impact Report
Version change: 1.0.0 -> 1.0.0 (same-day non-semantic normalization)
Modified principles:
- I. Information Sedimentation Is The Product Spine -> same title, CHECK wording only
- II. Source-Grounded Answers Only -> same title, CHECK wording only
- III. Knowledge Cards Are The Data Foundation -> same title, CHECK wording only
- IV. P0 Scope Is Narrow And Non-Negotiable -> same title, CHECK wording only
- V. Cold Start Must Work For One Author First -> same title, CHECK wording only
Added sections: N/A
Removed sections: N/A
Templates requiring updates:
- checked/no update required: .specify/templates/checklist-template.md
- checked/no update required: .specify/templates/constitution-template.md
- checked/no update required: .specify/templates/plan-template.md
- checked/no update required: .specify/templates/spec-template.md
- checked/no update required: .specify/templates/tasks-template.md
- checked/no command templates found: .specify/templates/commands/*.md
- not modified by request: .specify/scripts/powershell/*.ps1
- not modified by request: .specify/integrations/*.json
- not modified by request: .specify/workflows/*
Follow-up TODOs:
- None
-->

# NJU 知识库 Constitution

## Core Principles

### I. Information Sedimentation Is The Product Spine

Every product decision MUST serve NJU information sedimentation: information must be
left behind, found later, and cited to a source. A feature belongs in this product
only if it directly improves one of those three outcomes.

Features that are merely useful student productivity tools MUST remain outside this
product unless they are re-scoped around information sedimentation. Textbook Q&A,
homework boards, ToDo planning, open-domain chat, and companion-style memory are
explicit non-goals for P0.

CHECK: every spec and plan MUST name at least one sedimentation outcome it
improves: left behind, found later, or cited to source. If none applies, the
proposal is outside the product boundary.

Rationale: the product exists because NJU experience and administrative knowledge
are scattered across people, QQ groups, and ad hoc documents. Rebuilding a broad
learning workspace would repeat the v0.3 failure mode.

### II. Source-Grounded Answers Only

The Q&A Agent MUST answer only from retrieved knowledge cards. Every substantive
claim in an answer MUST point back to a specific card and its source metadata.
If retrieval finds no sufficient basis, the system MUST refuse with a clear
"knowledge base has no relevant content" response and record the question as a gap.

The Agent MUST NOT use general LLM training knowledge as a fallback, even with a
disclaimer. It MUST NOT invent, complete, or smooth over missing NJU-specific facts.
It MUST NOT mix unrelated or conflicting sources into a single answer when doing so
weakens card-level explainability.

CHECK: every answer-generation design MUST show the citation path, the no-hit
refusal path, and the gap-recording path. Any design that falls back to general
LLM knowledge fails this principle.

Rationale: wrong answers about degree rules, recommendation requirements,
registration, or campus procedures can cause real user harm. Trust depends on
being reliably traceable, not on sounding complete.

### III. Knowledge Cards Are The Data Foundation

Knowledge MUST be stored as small-grained cards rather than broad articles for P0.
Each card MUST represent one independent knowledge point and include, at minimum:
summary, body, source link when available, source description, domain tag,
verification status, created time, and updated time.

Source link and source description MUST remain separate fields. Cards with no
jumpable source, such as "asked a senior student", MUST still preserve a textual
source description and MUST NOT show a broken jump action.

Associations between cards MAY be reserved in the model, but P0 MUST NOT require a
full knowledge graph before the core card and answer loop works.

CHECK: every data model or migration plan that touches knowledge content MUST keep
card granularity, source link, source description, verification status, created
time, and updated time visible. It MUST NOT collapse link and description into one
ambiguous source field.

Rationale: card-level granularity makes retrieval more precise and makes citation
specific enough for users to inspect.

### IV. P0 Scope Is Narrow And Non-Negotiable

P0 MUST include only these product capabilities: author-managed knowledge card
entry, sourced Q&A, gap library, and user login through the existing authentication
foundation.

P0 MUST NOT include forum or UGC contribution, automatic gap-answer push,
time-sensitive activity or deadline data, Wiki browsing mode, external contribution
safety review, personalized Agent memory, textbook Q&A, homework boards, ToDo, paid
features, or commercialization.

P0 content work MUST concentrate implementation effort on stable freshman-entry
knowledge, such as program rules, course selection rules, registration process,
and department structure. Strongly time-sensitive arrangements MUST wait until P1
or later unless a future amendment moves them into P0.

CHECK: every P0 plan MUST list its included capabilities and explicitly confirm
that no P0 non-goal is required for the feature to work.

Rationale: the first usable version is time-boxed to roughly half a month. If that
box is exceeded, scope MUST be reduced instead of weakening source quality.

### V. Cold Start Must Work For One Author First

The product MUST be useful before network effects exist. P0 content MUST be seeded
by the author, and every unanswered user question MUST enter the gap library so the
author can decide what card to add next.

P0 success MUST be evaluated by real author usage: the author MUST be able to use
the product as the preferred path over searching multiple QQ groups or repeatedly
asking seniors. Broad campus adoption MUST NOT be used as a P0 success criterion.

CHECK: every P0 spec MUST define a single-author validation signal and MUST NOT
depend on voluntary contributions from other users.

Rationale: network effects are a future moat, not a starting condition. The only
practical cold-start path is to create enough content value before asking others to
contribute.

## Product Constraints

All specifications and plans MUST preserve the product boundary: NJU knowledge
base plus source-grounded Q&A Agent. For speckit-plan Constitution Check, every
plan MUST record PASS, BLOCKED, or N/A with evidence for each CHECK below. N/A is
allowed only when the feature does not touch the relevant surface.

- CHECK Product boundary: the feature MUST state which sedimentation outcome it
  improves: left behind, found later, or cited to source.
- CHECK Source grounding: any Q&A or generated-answer behavior MUST cite retrieved
  cards, MUST refuse when retrieval has no sufficient basis, and MUST record the
  missing question in the gap library.
- CHECK No general fallback: plans MUST NOT rely on general LLM training knowledge,
  open-domain chat, or unstated NJU facts to complete an answer.
- CHECK Knowledge-card foundation: data designs MUST preserve card-level storage,
  separate source link and source description fields, verification status, created
  time, and updated time.
- CHECK Trust visibility: unverified or senior-sourced content MUST remain
  distinguishable from verified official-source content in system behavior and in
  any planned UI surface.
- CHECK Phase boundary: work that depends on UGC, forum behavior, push automation,
  Wiki browsing, personalized memory, time-sensitive data, payment, or
  commercialization MUST be marked outside P0.

A BLOCKED check MUST stop the plan until the spec is narrowed, moved to a later
phase, or this constitution is amended first.

## P0 Delivery Rules

P0 plans MUST pass all delivery checks below before tasks are generated:

- CHECK Authentication reuse: P0 MUST reuse existing NextAuth login unless a
  concrete blocker is documented. P0 MUST NOT require new identity infrastructure.
- CHECK Storage reuse: P0 MUST reuse the existing PostgreSQL foundation unless a
  concrete blocker is documented. Semantic retrieval with pgvector MAY be
  considered without changing the database category.
- CHECK Data safety: P0 work MUST NOT include platform scraping, simulated login
  to university systems, or collection of private academic data. Content MUST
  enter through author entry or user-provided material that is explicitly reviewed.
- CHECK Forum boundary: current forum tables MUST be treated as future P2 assets
  unless a task explicitly requires a narrow bridge. Forum or UGC behavior MUST
  NOT become part of P0 by accident.
- CHECK P0 scope: P0 MUST deliver author-managed knowledge card entry, sourced
  Q&A, gap library, and login. Any additional capability MUST be justified as
  necessary for those four capabilities or moved out of P0.
- CHECK Time box: if the plan cannot fit the roughly half-month P0 time box, scope
  MUST be reduced before source quality, citation quality, or no-hit handling is
  weakened.

## Governance

This constitution supersedes earlier product direction that framed the system as an
integrated learning productivity workspace. Any future spec, plan, task list, or
implementation change MUST pass the principles above before work begins.

Amendments MUST be made by updating this document first when a change alters product
scope, trust rules, data foundation, or roadmap phase boundaries. Dependent specs,
plans, templates, and docs MUST then be reviewed for consistency.

Versioning follows semantic versioning:
- MAJOR: removes or redefines a core principle, changes the product spine, or
  permits behavior previously forbidden by source-grounding rules.
- MINOR: adds a new principle, governance section, phase boundary, or material
  product constraint.
- PATCH: clarifies wording without changing decision rules.

Compliance review MUST happen during planning and before implementation completion.
Any P0 task that adds non-goal functionality, weakens citation requirements, or
depends on unearned network effects MUST be rejected or moved to a later phase.

**Version**: 1.0.0 | **Ratified**: 2026-05-30 | **Last Amended**: 2026-05-30
