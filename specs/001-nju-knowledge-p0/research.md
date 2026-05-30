# Research: NJU 知识库 P0

## Decision: Reuse existing NextAuth identity and ADMIN role for author controls

Rationale: The current app already has NextAuth credentials login, JWT sessions,
and a `Role` enum with `ADMIN`. P0 needs one author-managed workflow, not a new
identity model. Treating the author as an existing admin satisfies the product
rule to reuse login and keeps scope small.

Alternatives considered:
- Add a new `AUTHOR` role: rejected for P0 because it changes authorization
  semantics without product benefit.
- Build separate invite-based author access: rejected because P0 is single-author
  and does not need collaboration.

## Decision: Add knowledge-specific models instead of repurposing forum tables

Rationale: Product v1.0 explicitly treats forum/UGC behavior as P2. Knowledge
cards have different invariants from posts: small-grained card structure,
separate source URL and description, verification status, and citation behavior.
New models can relate to `User` for authorship while leaving current forum tables
unchanged.

Alternatives considered:
- Store cards as forum posts: rejected because this would pull UGC/forum behavior
  into P0 by accident.
- Use a JSON blob table: rejected because source, verification, and gap handling
  need clear queryable fields.

## Decision: Use conservative text retrieval for P0; defer pgvector

Rationale: P0 must fit a half-month time box and validate the product loop first.
The existing PostgreSQL foundation can support keyword/domain-tag retrieval over
card summary and body. This is enough for the prepared freshman-entry validation
set and avoids requiring a database extension during P0.

Alternatives considered:
- Use pgvector immediately: reserved for later because it adds embedding
  generation, extension setup, and ranking complexity before the content loop is
  proven.
- Require a full knowledge graph: rejected by the constitution; associations may
  be reserved but must not block P0.

## Decision: Make answer generation card-bounded with explicit no-hit behavior

Rationale: The core trust rule is "溯源 + 不编造". The answer service must receive
only retrieved card evidence and must either produce cited claims or return a
no-content response that creates a gap. The plan may use a server-side
OpenAI-compatible endpoint through `fetch`, but general model knowledge is never a
fallback path.

Alternatives considered:
- Let the model answer from general knowledge with a disclaimer: rejected because
  it violates the product red line.
- Return raw card snippets without generation: acceptable as a fallback if answer
  generation is unavailable, but the P0 user experience should still aim for a
  concise card-grounded answer.

## Decision: Track source type separately from verification status

Rationale: "问学长" and "官方来源" describe source type, while "已核实" describes
trust state. Keeping these separate allows the UI and answer behavior to show
unverified or senior-sourced content distinctly from verified official-source
content.

Alternatives considered:
- One combined trust field: rejected because it makes "senior-sourced but
  author-verified" ambiguous.
- Source URL only: rejected because some valid P0 sources have no jumpable link.

## Decision: Store no-hit questions as gaps with dedupe support

Rationale: A no-hit question is a product signal. The author needs a manageable
gap library, so gaps should keep original question text, status, timestamps, and
optional duplicate linkage or normalized text for repeated questions.

Alternatives considered:
- Log no-hit questions only in server logs: rejected because the author cannot use
  logs as a product workflow.
- Automatically notify the user after handling: rejected for P0 because automatic
  push is a P1 capability.

## Decision: Keep P0 UI surfaces narrow

Rationale: P0 needs one user Q&A surface and two author surfaces: card management
and gap review. Wiki browsing, public card exploration, and forum contribution are
deliberately out of scope.

Alternatives considered:
- Build a public Wiki browse mode: rejected as P1.
- Add user contribution forms: rejected as P2 UGC.

## Decision: Validate through lint/build plus manual acceptance flows

Rationale: The repository currently has no configured dedicated test framework.
The near-term plan should still be verifiable through existing scripts and a
manual validation set: card CRUD, supported answer, no-hit gap, authorization
boundary, and P0 non-goal rejection.

Alternatives considered:
- Add a test framework during planning: rejected because dependency installation
  requires separate approval and is not necessary to create the implementation
  plan.
