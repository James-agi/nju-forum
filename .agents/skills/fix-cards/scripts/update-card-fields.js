#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const ALLOWED_FIELDS = [
  "summary", "body", "sourceExcerpt", "sourceUrl", "sourceUrls",
  "sourceDescription", "sourceType", "verificationStatus",
  "domainTag", "archivedAt",
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return args;
}

// 本机绝对路径判定：X:/… 盘符路径 或 file:// —— 这类写进来源前端会得到打不开的 file:// 链接。
// 也能挡住 Git Bash 把 /pdfs/x 篡改成的 C:/Program Files/Git/pdfs/x。
function isLocalPath(s) {
  if (s == null) return false;
  const n = String(s).replace(/\\/g, "/").trim();
  return /^[a-zA-Z]:\//.test(n) || /^file:\/\//i.test(n);
}

// sourceUrls 存的是一个 JSON 数组字符串；容错解析成 string[]
function parseUrls(raw) {
  if (!raw) return [];
  const t = String(raw).trim();
  if (!t) return [];
  try {
    const p = JSON.parse(t);
    if (Array.isArray(p)) return p.map(String);
    if (typeof p === "string") return [p];
    return [];
  } catch {
    return [];
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cardId = args.id;
  const isApply = !!args.apply;
  const noSyncUrls = !!args["no-sync-urls"];

  if (!cardId) {
    console.error("Usage: node update-card-fields.js --id <card-id> [--summary-env ENV] [--body-env ENV] [--source-excerpt-env ENV] [--sourceUrl <url>] [--no-sync-urls] [--apply]");
    process.exit(1);
  }

  const envFields = {
    summary: args["summary-env"],
    body: args["body-env"],
    sourceExcerpt: args["source-excerpt-env"],
  };

  const data = {};
  for (const [field, envName] of Object.entries(envFields)) {
    if (!envName) continue;
    const val = process.env[envName];
    if (val === undefined) {
      console.error(`Environment variable $${envName} is not set`);
      process.exit(1);
    }
    if (!ALLOWED_FIELDS.includes(field)) {
      console.error(`Field "${field}" is not in whitelist`);
      process.exit(1);
    }
    data[field] = val;
  }

  for (const key of Object.keys(args)) {
    if (ALLOWED_FIELDS.includes(key) && !envFields[key]) {
      if (key === "archivedAt") {
        data[key] = args[key] === "now" ? new Date() : new Date(args[key]);
      } else {
        data[key] = args[key];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    console.error("No fields to update. Provide --summary-env, --body-env, etc.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const card = await prisma.knowledgeCard.findUnique({ where: { id: cardId } });

  if (!card) {
    console.error(`Card not found: ${cardId}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // --- sourceUrls 自动同步 ---
  // 改动 sourceUrl 时，默认把 sourceUrls 一并规整为「新链接在首，去掉旧链接，保留其余」，
  // 避免 sourceUrl 与 sourceUrls 漂移不一致（见 source-link 排查）。显式传 --sourceUrls 或
  // --no-sync-urls 时不干预。
  const explicitSourceUrls = Object.prototype.hasOwnProperty.call(data, "sourceUrls");
  if (data.sourceUrl !== undefined && !explicitSourceUrls && !noSyncUrls) {
    const existing = parseUrls(card.sourceUrls);
    const oldUrl = card.sourceUrl;
    const newUrl = data.sourceUrl;
    const rest = existing.filter((u) => u !== oldUrl && u !== newUrl);
    const synced = newUrl ? [newUrl, ...rest] : rest;
    data.sourceUrls = synced.length ? JSON.stringify(synced) : null;
    console.log(`[sync] sourceUrl 改动 -> 自动同步 sourceUrls = ${data.sourceUrls}  (加 --no-sync-urls 关闭)`);
  }

  // --- 护栏：拒绝把本机绝对路径写进来源字段 ---
  const badTargets = [];
  if (data.sourceUrl !== undefined && isLocalPath(data.sourceUrl)) badTargets.push(`sourceUrl = ${data.sourceUrl}`);
  if (data.sourceUrls !== undefined && data.sourceUrls != null) {
    for (const u of parseUrls(data.sourceUrls)) if (isLocalPath(u)) badTargets.push(`sourceUrls[] = ${u}`);
  }
  if (badTargets.length) {
    console.error("拒绝写入：来源字段含本机绝对路径（前端会得到打不开的 file:// 链接）：");
    for (const b of badTargets) console.error("  " + b);
    console.error("sourceUrl 应为 http(s):// 或站内 /… 路径。若在 Git Bash 里传 /pdfs/… 被篡改成 C:/Program Files/Git/…，改用 MSYS_NO_PATHCONV=1 或走环境变量传值。");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Card: ${card.summary}`);
  console.log(`Fields: ${Object.keys(data).join(", ")}`);
  console.log(`Mode: ${isApply ? "APPLY" : "DRY-RUN (pass --apply to write)"}`);

  for (const [field, value] of Object.entries(data)) {
    if (field === "archivedAt") {
      console.log(`  ${field}: -> ${value instanceof Date ? value.toISOString() : String(value)}`);
      continue;
    }
    const oldStr = card[field] == null ? "" : String(card[field]);
    const newStr = value == null ? "(null)" : String(value);
    console.log(`  ${field} (${oldStr.length} -> ${value == null ? 0 : newStr.length} chars)`);
  }

  if (!isApply) {
    await prisma.$disconnect();
    return;
  }

  // --- 写前把整张卡快照备份，便于回滚 ---
  const backupDir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${cardId}-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ backedUpAt: new Date().toISOString(), changedFields: Object.keys(data), card }, null, 2),
    "utf8"
  );
  console.log(`\nBackup(整卡快照) -> ${backupPath}`);

  await prisma.knowledgeCard.update({ where: { id: cardId }, data });

  const updated = await prisma.knowledgeCard.findUnique({ where: { id: cardId } });
  console.log("\nVerification:");
  for (const field of Object.keys(data)) {
    const v = updated[field];
    console.log(`  ${field}: OK (${v == null ? 0 : String(v).length} chars)`);
  }
  // sourceUrl 改动后确认它确实落在 sourceUrls 数组内
  if (data.sourceUrl !== undefined && updated.sourceUrl) {
    const arr = parseUrls(updated.sourceUrls);
    console.log(`  sourceUrls 一致性: ${arr.includes(updated.sourceUrl) ? "OK (sourceUrl ∈ sourceUrls)" : "WARN sourceUrl 不在 sourceUrls"}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
