# Source-to-card pipeline kit

This is a portable demonstration of the project's production knowledge-card workflow. It turns a URL list into independently auditable card jobs and preserves the evidence trail instead of treating card generation as a one-shot prompt.

It is intentionally separate from the application database, admin page, private credentials, and Nanjing University-specific rules. A recipient can copy this directory into another project and change only the configuration and rules.

## What it demonstrates

```text
URL list
  -> read rules
  -> create traceable cards
  -> compare every card with the source
  -> optional second review
  -> validate and export cards.json
```

Each URL becomes a job directory containing its input, stage prompts, `cards.json`, `cards.md`, and `iteration.md`. The run-level export contains `all-cards.json` and a compact report.

## Run the local demonstration

Requires Node.js 20 or later. It does not call an AI service or fetch the example URL.

```powershell
cd showcase/card-pipeline-kit
npm run demo
npm run validate:demo
```

The result is written to `runs/demo/export/all-cards.json`. The generated `runs/` directory is ignored by Git.

## Use with another project

1. Copy this folder into the target repository.
2. Replace `examples/card-rules.md` with domain-specific evidence and writing rules.
3. Replace `examples/config.json` with the URL list, an optional review instruction, and an Agent command template.
4. Scaffold a run and inspect its prompts before allowing an Agent to execute them.

```powershell
node src/cli.mjs scaffold --config my-config.json --out runs/first-run
node src/cli.mjs run --config my-config.json --out runs/first-run --execute
node src/cli.mjs validate --run runs/first-run
```

`scaffold` is local-only. `run --execute` invokes the configured Agent command and that Agent may access external URLs according to its own configuration.

## Configuration

```json
{
  "projectName": "My knowledge base",
  "rulesFile": "./card-rules.md",
  "agentCommandTemplate": "opencode run --dangerously-skip-permissions -f \"{promptFile}\"",
  "review": {
    "enabled": true,
    "prompt": "Review the cards for unsupported claims and reader clarity."
  },
  "sources": [
    { "title": "Policy guide", "url": "https://example.org/policy" }
  ]
}
```

The command template may use `{promptFile}`, `{jobDirectory}`, and `{sourceUrl}`. Keep API keys out of this file and supply them through the Agent provider's normal environment configuration.

## Card contract

The validator requires `summary`, `body`, `sourceExcerpt`, `sourceUrl`, `sourceDescription`, `sourceType`, `domainTag`, and `verificationStatus` on each card. It also verifies that every card refers to the URL of its job. Semantic truthfulness remains the responsibility of the source-comparison and human-review stages; the validator is intentionally structural rather than a false claim of fully automatic fact checking.

## Relationship to the application

This package is distilled from the production batch-card workflow, but does not replace it. The application adds UI management, database duplicate handling, project-specific card fields, and provider-specific session management. This kit is the shareable method: source-bounded generation, explicit review stages, reproducible artifacts, and machine-checkable output.
