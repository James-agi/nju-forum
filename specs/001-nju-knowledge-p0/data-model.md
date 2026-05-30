# Data Model: NJU 知识库 P0

## Overview

P0 adds knowledge-specific entities beside the existing forum schema. Existing
`User` remains the identity anchor. Current forum entities (`Post`, `Reply`,
`Section`, `Tag`, `Favorite`) remain future P2 assets and are not part of the P0
knowledge workflow.

## Enums

### SourceType

- `OFFICIAL`: official NJU website, official department page, or official
  document.
- `DOCUMENT`: non-official but jumpable document or collected material.
- `SENIOR`: information obtained from a senior student or experienced person.
- `AUTHOR_EXPERIENCE`: author's own verified experience.
- `OTHER`: source is known but does not fit the above categories.

### VerificationStatus

- `VERIFIED`: author has checked the content sufficiently for P0 use.
- `UNVERIFIED`: content is useful but still needs review.
- `NEEDS_REVIEW`: content may be stale, conflicting, or insufficiently supported.

### QuestionStatus

- `ANSWERED`: answer was produced from sufficient card evidence.
- `GAP_RECORDED`: no sufficient evidence existed and a gap was created.
- `OUT_OF_SCOPE`: request does not serve NJU information sedimentation or is a
  P0 non-goal.

### GapStatus

- `OPEN`: author has not handled the gap.
- `HANDLED`: author has handled the gap, usually by adding or updating a card.
- `DUPLICATE`: gap duplicates another existing gap.
- `OUT_OF_SCOPE`: gap should not become P0 content.

## Entities

### KnowledgeCard

Represents one independent NJU knowledge point.

Fields:
- `id`: stable unique identifier.
- `summary`: one-sentence card summary for scanning and retrieval.
- `body`: complete card content for answer grounding.
- `sourceUrl`: optional jumpable source URL.
- `sourceDescription`: required textual source description.
- `sourceType`: required `SourceType`.
- `verificationStatus`: required `VerificationStatus`.
- `domainTag`: required open text tag, initially focused on freshman-entry
  stable knowledge.
- `createdById`: `User.id` of the author who created the card.
- `updatedById`: optional `User.id` of the latest author/editor.
- `createdAt`: creation timestamp.
- `updatedAt`: update timestamp.
- `archivedAt`: optional timestamp for hiding obsolete cards without deleting
  audit context.

Relationships:
- Many cards can be created by one user.
- A card can support many citations.
- A card can be linked to handled gaps.

Validation rules:
- `summary`, `body`, `sourceDescription`, `sourceType`, `verificationStatus`,
  and `domainTag` are required.
- `sourceUrl` may be empty, but `sourceDescription` must never be empty.
- `sourceUrl`, when present, must be a valid URL.
- `summary` should stay short enough for list scanning.
- Cards must represent a single knowledge point, not a broad article.

### KnowledgeQuestion

Records a submitted user question and its outcome.

Fields:
- `id`: stable unique identifier.
- `askerId`: `User.id` for the logged-in user who asked.
- `originalText`: exact submitted question.
- `normalizedText`: normalized text for dedupe and review.
- `status`: required `QuestionStatus`.
- `createdAt`: submission timestamp.

Relationships:
- One question can have zero or one answer.
- One question can create zero or one gap.
- One user can submit many questions.

Validation rules:
- Question text is required and must not be only whitespace.
- Requests outside P0 boundaries should be marked `OUT_OF_SCOPE`, not answered
  from general knowledge.

### KnowledgeAnswer

Stores a card-grounded answer for traceability.

Fields:
- `id`: stable unique identifier.
- `questionId`: related `KnowledgeQuestion.id`.
- `answerText`: answer shown to the user.
- `createdAt`: answer timestamp.

Relationships:
- One answer belongs to one question.
- One answer has one or more citations.

Validation rules:
- An answer must have at least one citation.
- Answer text must not contain claims unsupported by the cited cards.

### KnowledgeCitation

Represents a visible link from an answer claim to a supporting card.

Fields:
- `id`: stable unique identifier.
- `answerId`: related `KnowledgeAnswer.id`.
- `cardId`: related `KnowledgeCard.id`.
- `claimText`: short claim or answer segment supported by the card.
- `createdAt`: citation timestamp.

Relationships:
- Many citations can belong to one answer.
- Many citations can point to one card.

Validation rules:
- `claimText` must be present.
- The cited card must not be archived.

### KnowledgeGap

Represents a question the system could not answer from sufficient card evidence.

Fields:
- `id`: stable unique identifier.
- `questionId`: optional related `KnowledgeQuestion.id`.
- `originalQuestion`: preserved user question text.
- `normalizedQuestion`: normalized text for dedupe.
- `status`: required `GapStatus`.
- `handledById`: optional `User.id` of the author who handled the gap.
- `handledAt`: optional handling timestamp.
- `linkedCardId`: optional card that resolved the gap.
- `duplicateOfId`: optional reference to another gap.
- `createdAt`: creation timestamp.
- `updatedAt`: update timestamp.

Relationships:
- One gap may come from one question.
- One gap may be resolved by one card.
- One gap may duplicate another gap.

Validation rules:
- `originalQuestion` is required.
- `HANDLED` gaps should have `handledById` and `handledAt`.
- `DUPLICATE` gaps should reference `duplicateOfId`.
- Automatic user push after handling is not part of P0.

## State Transitions

### Question

```text
submitted
  ├─ sufficient card evidence -> ANSWERED -> KnowledgeAnswer + citations
  ├─ no sufficient card evidence -> GAP_RECORDED -> KnowledgeGap OPEN
  └─ P0 non-goal or open-domain request -> OUT_OF_SCOPE
```

### Gap

```text
OPEN
  ├─ author adds/links relevant card -> HANDLED
  ├─ author identifies existing same gap -> DUPLICATE
  └─ author confirms out-of-P0 scope -> OUT_OF_SCOPE
```

### Card

```text
active
  ├─ author updates content/source/trust fields -> active with updatedAt
  └─ author retires stale card -> archived
```

## Data Safety Rules

- No platform scraping data is modeled.
- No simulated university-login data is modeled.
- No private academic records are modeled.
- User questions are stored only to support answer traceability and gap review.
