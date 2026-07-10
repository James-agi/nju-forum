import { spawn } from "node:child_process";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const REQUIRED_CARD_FIELDS = [
  "summary",
  "body",
  "sourceExcerpt",
  "sourceUrl",
  "sourceDescription",
  "sourceType",
  "domainTag",
  "verificationStatus",
];

const PHASES = ["read_rules", "create_cards", "compare_source"];

function now() {
  return new Date().toISOString();
}

function safeSegment(value, fallback) {
  const result = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return result || fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read JSON at ${filePath}: ${message}`);
  }
}

export async function loadConfig(configPath) {
  const config = await readJson(configPath);
  const configDirectory = path.dirname(configPath);

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Config must be a JSON object.");
  }
  if (typeof config.projectName !== "string" || !config.projectName.trim()) {
    throw new Error("Config requires a non-empty projectName.");
  }
  if (typeof config.rulesFile !== "string" || !config.rulesFile.trim()) {
    throw new Error("Config requires rulesFile.");
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    throw new Error("Config requires at least one source.");
  }

  for (const source of config.sources) {
    if (!source || typeof source.url !== "string") {
      throw new Error("Each source requires a url.");
    }
    try {
      const url = new URL(source.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("URL must use http or https.");
      }
    } catch {
      throw new Error(`Invalid source URL: ${source.url}`);
    }
  }

  const rulesPath = path.resolve(configDirectory, config.rulesFile);
  if (!(await exists(rulesPath))) {
    throw new Error(`Rules file does not exist: ${rulesPath}`);
  }

  return { config, configDirectory, rulesPath };
}

function buildPrompt({ phase, job, rulesPath, review }) {
  const header = [
    `# ${phase}`,
    "",
    `Job directory: ${job.directory}`,
    `Source URL: ${job.source.url}`,
    `Source title: ${job.source.title || "Not supplied"}`,
    `Rules file: ${rulesPath}`,
    "",
  ];

  if (phase === "read_rules") {
    return header.concat([
      "Read the rules file. Do not fetch the source or create cards in this stage.",
      "Reply only after you understand the evidence boundary and the output contract.",
      "",
    ]).join("\n");
  }

  if (phase === "create_cards") {
    return header.concat([
      "First read the rules file, even if this is a fresh Agent session.",
      "Fetch or read the source URL using your available tools.",
      "Create cards only from source-supported facts. Do not write to databases or external systems.",
      "Write cards.json, cards.md, and iteration.md in the job directory.",
      "If the source cannot be read or yields no reliable card, write [] to cards.json and explain why in iteration.md.",
      "",
      outputContract(),
    ]).join("\n");
  }

  if (phase === "compare_source") {
    return header.concat([
      "First read the rules file, even if this is a fresh Agent session.",
      "Re-read the source and compare every card with it sentence by sentence.",
      "Remove claims that exceed the source, restore material omissions, and preserve scope and dates.",
      "Overwrite cards.json and cards.md with the corrected version. Record the audit in iteration.md.",
      "",
      outputContract(),
    ]).join("\n");
  }

  if (phase === "review") {
    return header.concat([
      "Perform a second review. Read cards.json, iteration.md, and the source before making changes.",
      review.prompt,
      "Overwrite cards.json and cards.md when corrections are needed, then append the review result to iteration.md.",
      "",
      outputContract(),
    ]).join("\n");
  }

  throw new Error(`Unknown phase: ${phase}`);
}

function outputContract() {
  return [
    "## Output contract",
    "",
    "cards.json must be a JSON array. Every item requires:",
    REQUIRED_CARD_FIELDS.map((field) => `- ${field}`).join("\n"),
    "- action: create or merge (optional)",
    "- sourceUrls: array of supporting URLs (optional)",
    "",
  ].join("\n");
}

export async function scaffoldRun({ configPath, outputDirectory }) {
  const absoluteConfigPath = path.resolve(configPath);
  const rootDirectory = path.resolve(outputDirectory);
  const { config, rulesPath } = await loadConfig(absoluteConfigPath);
  const manifestPath = path.join(rootDirectory, "manifest.json");

  if (await exists(manifestPath)) {
    return readJson(manifestPath);
  }

  await mkdir(rootDirectory, { recursive: true });
  const jobs = config.sources.map((source, index) => {
    const id = String(index + 1).padStart(3, "0");
    const label = safeSegment(source.title || new URL(source.url).hostname, "source");
    return {
      id,
      source,
      directory: path.join(rootDirectory, "jobs", `${id}-${label}`),
      status: "SCAFFOLDED",
    };
  });
  const manifest = {
    version: 1,
    projectName: config.projectName,
    createdAt: now(),
    configPath: absoluteConfigPath,
    rulesPath,
    review: config.review || { enabled: false },
    agentCommandTemplate: config.agentCommandTemplate || "",
    jobs,
  };

  for (const job of jobs) {
    await mkdir(job.directory, { recursive: true });
    await writeFile(path.join(job.directory, "input.json"), JSON.stringify(job.source, null, 2) + "\n");
    const phases = [...PHASES];
    if (manifest.review.enabled) phases.push("review");
    for (const [index, phase] of phases.entries()) {
      const fileName = `${String(index + 1).padStart(2, "0")}-${phase}.md`;
      const prompt = buildPrompt({ phase, job, rulesPath, review: manifest.review });
      await writeFile(path.join(job.directory, fileName), prompt, "utf8");
    }
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

function promptFilesForJob(job, reviewEnabled) {
  const phases = [...PHASES];
  if (reviewEnabled) phases.push("review");
  return phases.map((phase, index) => path.join(job.directory, `${String(index + 1).padStart(2, "0")}-${phase}.md`));
}

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Agent command exited with code ${code ?? "unknown"}.`));
    });
  });
}

function expandCommand(template, promptFile, job) {
  return template
    .replaceAll("{promptFile}", promptFile)
    .replaceAll("{jobDirectory}", job.directory)
    .replaceAll("{sourceUrl}", job.source.url);
}

export async function executeRun({ outputDirectory }) {
  const rootDirectory = path.resolve(outputDirectory);
  const manifestPath = path.join(rootDirectory, "manifest.json");
  const manifest = await readJson(manifestPath);
  if (!manifest.agentCommandTemplate.trim()) {
    throw new Error("agentCommandTemplate is empty. Set it in your config before using --execute.");
  }

  for (const job of manifest.jobs) {
    job.status = "RUNNING";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    try {
      for (const promptFile of promptFilesForJob(job, manifest.review?.enabled)) {
        await runCommand(expandCommand(manifest.agentCommandTemplate, promptFile, job), path.dirname(manifest.configPath));
      }
      const result = await validateJob(job);
      if (!result.ok) throw new Error(result.errors.join(" "));
      job.status = "EXPORTED";
    } catch (error) {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : String(error);
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  return manifest;
}

export async function validateJob(job) {
  const cardsPath = path.join(job.directory, "cards.json");
  const errors = [];
  if (!(await exists(cardsPath))) {
    return { ok: false, errors: [`${job.id}: cards.json is missing.`], cards: [] };
  }

  let cards;
  try {
    cards = await readJson(cardsPath);
  } catch (error) {
    return { ok: false, errors: [`${job.id}: ${error.message}`], cards: [] };
  }
  if (!Array.isArray(cards)) {
    return { ok: false, errors: [`${job.id}: cards.json must be an array.`], cards: [] };
  }

  cards.forEach((card, index) => {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      errors.push(`${job.id} card ${index + 1}: card must be an object.`);
      return;
    }
    for (const field of REQUIRED_CARD_FIELDS) {
      if (typeof card[field] !== "string" || !card[field].trim()) {
        errors.push(`${job.id} card ${index + 1}: ${field} must be a non-empty string.`);
      }
    }
    if (card.summary?.length > 200) {
      errors.push(`${job.id} card ${index + 1}: summary exceeds 200 characters.`);
    }
    if (card.sourceUrl && card.sourceUrl !== job.source.url && !card.sourceUrls?.includes(job.source.url)) {
      errors.push(`${job.id} card ${index + 1}: source URL does not reference this job source.`);
    }
    if (card.sourceUrls && (!Array.isArray(card.sourceUrls) || card.sourceUrls.some((url) => typeof url !== "string"))) {
      errors.push(`${job.id} card ${index + 1}: sourceUrls must be an array of strings.`);
    }
  });

  return { ok: errors.length === 0, errors, cards };
}

export async function validateRun({ outputDirectory }) {
  const manifest = await readJson(path.join(path.resolve(outputDirectory), "manifest.json"));
  const results = await Promise.all(manifest.jobs.map(validateJob));
  const errors = results.flatMap((result) => result.errors);
  return { ok: errors.length === 0, errors, cardCount: results.reduce((count, result) => count + result.cards.length, 0) };
}

export async function exportRun({ outputDirectory }) {
  const rootDirectory = path.resolve(outputDirectory);
  const manifest = await readJson(path.join(rootDirectory, "manifest.json"));
  const validation = await validateRun({ outputDirectory: rootDirectory });
  if (!validation.ok) throw new Error(validation.errors.join("\n"));

  const cards = [];
  for (const job of manifest.jobs) {
    cards.push(...(await readJson(path.join(job.directory, "cards.json"))));
  }
  const exportDirectory = path.join(rootDirectory, "export");
  await mkdir(exportDirectory, { recursive: true });
  await writeFile(path.join(exportDirectory, "all-cards.json"), JSON.stringify(cards, null, 2) + "\n");
  await writeFile(path.join(exportDirectory, "run-report.json"), JSON.stringify({
    projectName: manifest.projectName,
    exportedAt: now(),
    sourceCount: manifest.jobs.length,
    cardCount: cards.length,
    validation: "passed",
  }, null, 2) + "\n");
  return { cardCount: cards.length, exportDirectory };
}

export async function createDemo({ configPath, outputDirectory, demoCardsPath }) {
  const manifest = await scaffoldRun({ configPath, outputDirectory });
  if (manifest.jobs.length !== 1) throw new Error("The bundled demo expects exactly one source.");
  const job = manifest.jobs[0];
  await cp(demoCardsPath, path.join(job.directory, "cards.json"));
  await writeFile(path.join(job.directory, "cards.md"), "# Demonstration output\n\nThe card data is in cards.json.\n");
  await writeFile(path.join(job.directory, "iteration.md"), "# Review log\n\n- Draft checked against the supplied demonstration excerpt.\n- Response time was deliberately not invented because the source did not state one.\n");
  job.status = "EXPORTED";
  await writeFile(path.join(path.resolve(outputDirectory), "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return exportRun({ outputDirectory });
}
