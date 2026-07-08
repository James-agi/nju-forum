# Reviewed Card Replay Snapshot 20260708

This folder contains a replayable snapshot for the 324 cards covered by
`scripts/temp-audit/result-*.json` after the July 8 audit fixes.

## Files

- `scripts/temp-backups/reviewed-card-current-snapshot-20260708.json`
  - Current database snapshot for the reviewed cards after fixes.
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
  `verificationStatus`, `domainTag`, and `sourceUrls`.
- It is intended as a safety net if seed data overwrites the audited database
  fixes. It is not a replacement for updating canonical seed files.
