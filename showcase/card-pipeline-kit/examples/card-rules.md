# Knowledge card rules

## Evidence boundary

- Only state facts supported by the supplied source.
- Put the supporting original excerpt in `sourceExcerpt`.
- Mark time-sensitive facts with a date or scope when the source supplies one.
- When the source is incomplete or inaccessible, create no card rather than guessing.

## Card shape

- One card answers one user question.
- `summary` is a question-shaped title, no longer than 200 characters.
- `body` is concise, readable Markdown text. Do not put images in `body`.
- `sourceUrl` is the primary source. `sourceUrls` contains every supporting URL.
- New cards use `verificationStatus: "NEEDS_REVIEW"`.

## Review standard

- Check each card against the original source after drafting.
- Remove unsupported explanations and avoid turning examples into general rules.
- Record decisions, gaps, and remaining review work in `iteration.md`.
