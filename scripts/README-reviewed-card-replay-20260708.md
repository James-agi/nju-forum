# Reviewed Card Replay Snapshot 20260708

This replay command uses the committed canonical seed containing all 665 cards,
including the 324 cards covered by the July 8 audit fixes.

## Files

- `prisma/seed-data/knowledge-cards-current.json`
  - Committed canonical snapshot used by default.
- `scripts/replay-reviewed-card-snapshot-20260708.js`
  - Replays the snapshot into the current database.

## Usage

Dry-run first:

```powershell
node "scripts/replay-reviewed-card-snapshot-20260708.js"
```

Apply after a seed reset or database overwrite:

```powershell
node "scripts/replay-reviewed-card-snapshot-20260708.js" --apply
```

By default, archived cards from the snapshot are skipped. To include archived
cards too:

```powershell
node "scripts/replay-reviewed-card-snapshot-20260708.js" --apply --include-archived
```

## Notes

- The script updates existing cards by `id`; it does not create missing cards.
- It updates `summary`, `body`, `sourceExcerpt`, source metadata,
  `verificationStatus`, `verifiedAt`, `domainTag`, and `sourceUrls`.
- For a legacy `VERIFIED` card without `verifiedAt`, the committed snapshot's
  `exportedAt` is used as a deterministic restore timestamp.
- It is intended as a safety net if seed data overwrites the audited database
  fixes. It is not a replacement for updating canonical seed files.
