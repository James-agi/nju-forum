# P0 Scope Checklist: NJU 知识库 P0

**Purpose**: Validate that the P0 requirements are complete, unambiguous, and aligned with PRODUCT-v1 and the constitution before implementation.
**Created**: 2026-05-30
**Feature**: [spec.md](../spec.md)

## Product Boundary

- [ ] CHK001 Are the three sedimentation outcomes explicitly represented in the requirements: left behind, found later, and cited to source? [Completeness, Spec §Requirements]
- [ ] CHK002 Are P0 capabilities limited to author-managed card entry, sourced Q&A, gap library, and login? [Consistency, Spec §FR-013]
- [ ] CHK003 Are P1/P2 capabilities explicitly excluded from P0 requirements, including push, Wiki browsing, UGC/forum contribution, personalized memory, time-sensitive data, payment, and commercialization? [Coverage, Spec §FR-014]
- [ ] CHK004 Is freshman-entry stable knowledge clearly defined as the P0 content focus rather than a broad campus knowledge scope? [Clarity, Spec §FR-015]

## Source-Grounded Answers

- [ ] CHK005 Are requirements clear that every substantive answer claim must cite supporting knowledge cards? [Clarity, Spec §FR-008]
- [ ] CHK006 Are no-hit requirements complete, including user-facing refusal and gap recording? [Completeness, Spec §FR-010]
- [ ] CHK007 Is the prohibition on general LLM or background-knowledge fallback stated unambiguously? [Clarity, Spec §FR-009]
- [ ] CHK008 Are conflicting or unrelated-source scenarios addressed so the requirements prevent weak mixed-source answers? [Coverage, Spec §Edge Cases]
- [ ] CHK009 Are answer-generation failure and missing-configuration requirements reflected in the task plan without weakening the no-fallback rule? [Consistency, Tasks T032]

## Knowledge Card Data

- [ ] CHK010 Are required card fields complete: summary, body, source description, domain tag, verification status, created time, and updated time? [Completeness, Spec §FR-003]
- [ ] CHK011 Is optional source URL behavior specified separately from required source description? [Clarity, Spec §FR-004]
- [ ] CHK012 Are trust distinctions specified for verified, unverified, and senior-sourced content? [Completeness, Spec §FR-005]
- [ ] CHK013 Is small-grained card granularity required clearly enough to prevent broad article-style records? [Clarity, Spec §FR-002]
- [ ] CHK014 Are archived or stale card expectations documented sufficiently in the plan/tasks if implementation introduces archive behavior? [Consistency, Plan §Project Structure, Tasks T017]

## Gap Library

- [ ] CHK015 Are gap requirements complete enough to preserve original question, creation time, and handling status? [Completeness, Spec §FR-011]
- [ ] CHK016 Are requirements clear that repeated no-hit questions must not inflate demand as unrelated gaps? [Coverage, Spec §Edge Cases, Tasks T031]
- [ ] CHK017 Are handled-gap requirements specific about the author marking a gap handled after adding or updating knowledge? [Clarity, Spec §FR-012]
- [ ] CHK018 Is automatic notification after a gap is handled explicitly excluded from P0? [Consistency, Spec §Assumptions]

## Roles And Access Control

- [ ] CHK019 Is the P0 author role clearly mapped to the existing `ADMIN` role? [Clarity, Spec §Clarifications]
- [ ] CHK020 Are non-`ADMIN` restrictions documented for card and gap management? [Completeness, Spec §FR-017]
- [ ] CHK021 Are normal logged-in user capabilities distinguished from `ADMIN` author capabilities? [Consistency, Spec §Key Entities]
- [ ] CHK022 Are authentication reuse requirements consistent between spec, plan, and tasks? [Consistency, Spec §Assumptions, Plan §Constitution Check, Tasks T011]

## Acceptance Criteria Quality

- [ ] CHK023 Are success criteria measurable without depending on implementation details? [Measurability, Spec §Success Criteria]
- [ ] CHK024 Are manual acceptance flows traceable to user stories and tasks? [Traceability, Spec §User Scenarios, Tasks T023/T034/T040/T046]
- [ ] CHK025 Is the 30-question validation set requirement specific enough to evaluate supported answers and no-hit behavior? [Measurability, Spec §SC-004, Tasks T047]
- [ ] CHK026 Is the author trial usage criterion tied to real NJU information needs rather than broad adoption? [Clarity, Spec §SC-005]

## Implementation Readiness Boundaries

- [ ] CHK027 Are database schema application requirements separated from Prisma client generation so migrations still require explicit user confirmation? [Clarity, Tasks T041/T042]
- [ ] CHK028 Are dependency installation and new test framework decisions intentionally excluded unless separately approved? [Assumption, Tasks §Boundary Discipline]
- [ ] CHK029 Are forum tables treated as future P2 assets rather than implicit P0 data sources? [Consistency, Plan §Summary]
- [ ] CHK030 Are all P0 non-goals represented in at least one requirement, edge case, or task boundary check? [Coverage, Spec §FR-014, Tasks T048]
