import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDemo,
  executeRun,
  exportRun,
  scaffoldRun,
  validateRun,
} from "./workflow.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = args[index + 1];
    options[key] = next && !next.startsWith("--") ? next : true;
    if (options[key] !== true) index += 1;
  }
  return options;
}

function requireOption(options, key) {
  if (typeof options[key] !== "string" || !options[key].trim()) {
    throw new Error(`--${key} is required.`);
  }
  return options[key];
}

function help() {
  console.log(`Source-to-card pipeline kit

Commands:
  node src/cli.mjs demo
  node src/cli.mjs scaffold --config examples/config.json --out runs/my-run
  node src/cli.mjs run --config examples/config.json --out runs/my-run --execute
  node src/cli.mjs validate --run runs/my-run
  node src/cli.mjs export --run runs/my-run

The scaffold command writes prompts only. --execute runs the configured agent command and may fetch external URLs.`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const options = parseArgs(rest);

  if (command === "help" || command === "--help") return help();
  if (command === "demo") {
    const result = await createDemo({
      configPath: path.join(packageRoot, "examples", "config.json"),
      outputDirectory: path.join(packageRoot, "runs", "demo"),
      demoCardsPath: path.join(packageRoot, "examples", "demo-cards.json"),
    });
    console.log(`Demo exported ${result.cardCount} card(s) to ${result.exportDirectory}`);
    return;
  }
  if (command === "scaffold") {
    const manifest = await scaffoldRun({
      configPath: requireOption(options, "config"),
      outputDirectory: requireOption(options, "out"),
    });
    console.log(`Scaffolded ${manifest.jobs.length} job(s).`);
    return;
  }
  if (command === "run") {
    const configPath = requireOption(options, "config");
    const outputDirectory = requireOption(options, "out");
    const manifest = await scaffoldRun({ configPath, outputDirectory });
    if (options.execute !== true) {
      console.log(`Scaffolded ${manifest.jobs.length} job(s). Re-run with --execute to invoke the configured agent.`);
      return;
    }
    await executeRun({ outputDirectory });
    const result = await exportRun({ outputDirectory });
    console.log(`Exported ${result.cardCount} card(s) to ${result.exportDirectory}`);
    return;
  }
  if (command === "validate") {
    const result = await validateRun({ outputDirectory: requireOption(options, "run") });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    console.log(`Validation passed for ${result.cardCount} card(s).`);
    return;
  }
  if (command === "export") {
    const result = await exportRun({ outputDirectory: requireOption(options, "run") });
    console.log(`Exported ${result.cardCount} card(s) to ${result.exportDirectory}`);
    return;
  }
  help();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
