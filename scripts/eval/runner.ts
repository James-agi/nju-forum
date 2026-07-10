import { config } from "dotenv";
config();
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { db } from "../../src/lib/db";
import { evaluateEvidence, retrieveHybrid } from "../../src/lib/knowledge/retrieval";
import { expandQueryTerms } from "../../src/lib/knowledge/query-expansion";
import { buildCardBoundedAnswer } from "../../src/lib/knowledge/answer";
import { classifyNoResult, classifyP0Scope } from "../../src/lib/knowledge/scope";

interface EvalCase {
  id: string;
  question: string;
  scenario: string;
  expectedStatus: string | null;
  mustCiteCardSummaries: string[];
  mustMention: string[];
  mustNotMention: string[];
  mustNotStatus?: string;
  notes?: string;
}

interface EvalResult {
  id: string;
  question: string;
  scenario: string;
  status: string;
  answerMode: string;
  citeCount: number;
  citedSummaries: string[];
  result: "PASS" | "FAIL" | "MANUAL";
  failures: string[];
  answerPreview: string;
}

function getGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function stripQuestionEcho(answer: string, question: string): string {
  return answer.replace(new RegExp(`[「『]?${question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[」』]?`, "g"), "");
}

async function runCase(ec: EvalCase): Promise<EvalResult> {
  const scope = classifyP0Scope(ec.question);
  if (!scope.inScope) {
    return {
      id: ec.id, question: ec.question, scenario: ec.scenario,
      status: "OUT_OF_SCOPE", answerMode: "N/A", citeCount: 0,
      citedSummaries: [], result: "MANUAL", failures: [], answerPreview: scope.message || "",
    };
  }

  const expanded = await expandQueryTerms(ec.question);
  const retrieval = await retrieveHybrid(ec.question, 5, expanded);
  const evidence = evaluateEvidence(retrieval);

  if (!evidence.sufficient) {
    if (evidence.reason === "EMPTY") {
      const noResult = classifyNoResult(ec.question);
      const status = noResult === "OUT_OF_SCOPE" ? "OUT_OF_SCOPE" : "GAP_RECORDED";
      return {
        id: ec.id, question: ec.question, scenario: ec.scenario,
        status, answerMode: "N/A", citeCount: 0,
        citedSummaries: [], result: "MANUAL", failures: [], answerPreview: "",
      };
    }
    return {
      id: ec.id, question: ec.question, scenario: ec.scenario,
      status: "GAP_RECORDED", answerMode: "N/A", citeCount: 0,
      citedSummaries: [], result: "MANUAL", failures: [], answerPreview: "",
    };
  }

  const answer = await buildCardBoundedAnswer(ec.question, evidence.cards);
  const cardMap = new Map(evidence.cards.map(r => [r.card.id, r.card.summary]));
  const citedSummaries = answer.citations
    .map(c => cardMap.get(c.cardId) || "")
    .filter(Boolean);

  return {
    id: ec.id, question: ec.question, scenario: ec.scenario,
    status: "ANSWERED", answerMode: answer.answerMode,
    citeCount: answer.citations.length, citedSummaries,
    result: "MANUAL", failures: [],
    answerPreview: answer.answerText.slice(0, 120),
  };
}

function evaluate(ec: EvalCase, result: EvalResult): EvalResult {
  const failures: string[] = [];

  if (ec.expectedStatus && result.status !== ec.expectedStatus) {
    failures.push(`期望 ${ec.expectedStatus} 实际 ${result.status}`);
  }

  if (ec.mustNotStatus && result.status === ec.mustNotStatus) {
    failures.push(`不应为 ${ec.mustNotStatus}`);
  }

  if (result.status === "ANSWERED") {
    if (ec.mustCiteCardSummaries.length > 0) {
      for (const target of ec.mustCiteCardSummaries) {
        const found = result.citedSummaries.some(s =>
          s.toLowerCase().includes(target.toLowerCase())
        );
        if (!found) failures.push(`未引用含"${target}"的卡`);
      }
    }

    const cleaned = stripQuestionEcho(result.answerPreview, ec.question);
    if (ec.mustMention.length > 0) {
      for (const keyword of ec.mustMention) {
        if (!cleaned.includes(keyword)) {
          failures.push(`答案未提及"${keyword}"（已剥离问题回显）`);
        }
      }
    }

    if (ec.mustNotMention.length > 0) {
      for (const keyword of ec.mustNotMention) {
        if (result.answerPreview.includes(keyword)) {
          failures.push(`答案不应包含"${keyword}"`);
        }
      }
    }
  }

  const hasAssertions = ec.expectedStatus || ec.mustCiteCardSummaries.length > 0
    || ec.mustMention.length > 0 || ec.mustNotMention.length > 0 || ec.mustNotStatus;

  result.failures = failures;
  result.result = failures.length > 0 ? "FAIL" : hasAssertions ? "PASS" : "MANUAL";
  return result;
}

async function main() {
  const datasetPath = path.resolve(__dirname, "dataset.json");
  const dataset: EvalCase[] = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const commit = getGitCommit();

  console.log(`评估集: ${dataset.length} 题 | commit: ${commit}\n`);

  const results: EvalResult[] = [];

  for (const ec of dataset) {
    process.stdout.write(`[${ec.id}] ${ec.question} ... `);
    const raw = await runCase(ec);
    const result = evaluate(ec, raw);
    results.push(result);

    const icon = result.result === "PASS" ? "✓" : result.result === "FAIL" ? "✗" : "?";
    console.log(`${icon} ${result.status} mode=${result.answerMode} cite=${result.citeCount}`);
    if (result.failures.length > 0) {
      result.failures.forEach(f => console.log(`    - ${f}`));
    }
  }

  const pass = results.filter(r => r.result === "PASS").length;
  const fail = results.filter(r => r.result === "FAIL").length;
  const manual = results.filter(r => r.result === "MANUAL").length;
  const llmRate = results.filter(r => r.answerMode === "LLM").length;
  const fallbackRate = results.filter(r => r.answerMode === "FALLBACK").length;

  console.log(`\n=== 汇总 (${commit}) ===`);
  console.log(`PASS: ${pass}  FAIL: ${fail}  MANUAL: ${manual}`);
  console.log(`LLM回答: ${llmRate}  降级回答: ${fallbackRate}`);

  if (fail > 0) {
    console.log("\n失败项:");
    results.filter(r => r.result === "FAIL").forEach(r => {
      console.log(`  [${r.id}] ${r.question}`);
      r.failures.forEach(f => console.log(`    - ${f}`));
    });
  }

  const output = { commit, timestamp: new Date().toISOString(), summary: { pass, fail, manual, llmRate, fallbackRate }, results };
  fs.writeFileSync(path.resolve(__dirname, "result.json"), JSON.stringify(output, null, 2));
  console.log("\n结果写入 scripts/eval/result.json");
}

main().catch(console.error).finally(() => db.$disconnect());
