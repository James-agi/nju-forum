import { db } from "../../src/lib/db";
import { retrieveHybrid } from "../../src/lib/knowledge/retrieval";
import { expandQueryTerms } from "../../src/lib/knowledge/query-expansion";
import { hasVectors } from "../../src/lib/knowledge/vector-store";

interface RetrievalEvalCase {
  id: string;
  question: string;
  scenario: string;
  expectedCardTerms: string[][];
  minTop3Hits?: number;
  notes?: string;
}

interface RetrievalEvalResult {
  id: string;
  question: string;
  scenario: string;
  totalCandidates: number;
  top3CardSummaries: string[];
  hits: number;
  mrr: number;
  passed: boolean;
  failures: string[];
  expectedCardTerms: string[][];
}

async function computeMRR(
  retrieved: { card: { id: string; summary: string } }[],
  expectedTerms: string[][],
): Promise<{ hits: number; mrr: number }> {
  let hits = 0;
  let mrr = 0;

  for (const terms of expectedTerms) {
    const rank = retrieved.findIndex((r) =>
      terms.some((t) => r.card.summary.toLowerCase().includes(t.toLowerCase()))
    );
    if (rank !== -1) {
      hits++;
      mrr += 1 / (rank + 1);
    }
  }

  const count = expectedTerms.length || 1;
  return { hits, mrr: mrr / count };
}

async function runCase(ec: RetrievalEvalCase): Promise<RetrievalEvalResult> {
  const expanded = await expandQueryTerms(ec.question);
  const results = await retrieveHybrid(ec.question, 5, expanded);

  const top3Summaries = results.slice(0, 3).map((r) => r.card.summary);
  const { hits, mrr } = await computeMRR(results, ec.expectedCardTerms);

  const top3Hits = ec.expectedCardTerms.filter((terms) =>
    results.slice(0, 3).some((r) =>
      terms.some((t) => r.card.summary.toLowerCase().includes(t.toLowerCase()))
    )
  ).length;

  const failures: string[] = [];
  const minHits = ec.minTop3Hits ?? Math.min(ec.expectedCardTerms.length, 1);
  if (top3Hits < minHits) {
    failures.push(`Top3 命中 ${top3Hits}/${ec.expectedCardTerms.length} 不足 ${minHits}`);
  }

  return {
    id: ec.id,
    question: ec.question,
    scenario: ec.scenario,
    expectedCardTerms: ec.expectedCardTerms,
    totalCandidates: results.length,
    top3CardSummaries: top3Summaries,
    hits,
    mrr,
    passed: failures.length === 0,
    failures,
  };
}

const dataset: RetrievalEvalCase[] = [
  {
    id: "ret-fact-1",
    question: "转专业需要什么条件？",
    scenario: "关键词检索",
    expectedCardTerms: [["转专业"]],
  },
  {
    id: "ret-fact-2",
    question: "三三制是什么？",
    scenario: "关键词检索",
    expectedCardTerms: [["三三制"]],
  },
  {
    id: "ret-fact-3",
    question: "南大VPN怎么用？",
    scenario: "关键词检索",
    expectedCardTerms: [["VPN"]],
  },
  {
    id: "ret-rephrase-1",
    question: "保研怎么搞？",
    scenario: "口语改述",
    expectedCardTerms: [["保研"], ["推免"]],
    minTop3Hits: 1,
  },
  {
    id: "ret-rephrase-2",
    question: "宿舍几人间？",
    scenario: "口语改述",
    expectedCardTerms: [["宿舍"]],
  },
  {
    id: "ret-rephrase-3",
    question: "饭卡丢了怎么办？",
    scenario: "口语改述",
    expectedCardTerms: [["一卡通"], ["校园卡"]],
    minTop3Hits: 1,
  },
  {
    id: "ret-multi-1",
    question: "新生入学要准备什么？",
    scenario: "多卡检索",
    expectedCardTerms: [["新生"],["入学"]],
    minTop3Hits: 1,
  },
  {
    id: "ret-fresh-1",
    question: "学分绩怎么算？",
    scenario: "关键词检索",
    expectedCardTerms: [["学分绩"],["GPA"]],
    minTop3Hits: 1,
  },
  {
    id: "ret-edge-1",
    question: "南大校训",
    scenario: "短查询",
    expectedCardTerms: [["校训"]],
  },
  {
    id: "ret-edge-2",
    question: "南大奖学金有哪些？",
    scenario: "综合",
    expectedCardTerms: [["奖学金"]],
  },
];

async function main() {
  const vecAvailable = await hasVectors();
  console.log(`向量检索可用: ${vecAvailable}`);
  console.log(`评估集: ${dataset.length} 题\n`);

  const results: RetrievalEvalResult[] = [];

  for (const ec of dataset) {
    process.stdout.write(`[${ec.id}] ${ec.question} ... `);
    try {
      const result = await runCase(ec);
      results.push(result);
      const icon = result.passed ? "✓" : "✗";
      console.log(`${icon} hits=${result.hits}/${ec.expectedCardTerms.length} MRR=${result.mrr.toFixed(3)} top3=${result.top3CardSummaries.length}条`);
      if (result.failures.length > 0) {
        result.failures.forEach((f) => console.log(`    - ${f}`));
      }
    } catch (err) {
      console.log(`✗ ERROR: ${err}`);
    }
  }

  const pass = results.filter((r) => r.passed).length;
  const fail = results.filter((r) => !r.passed).length;
  const avgMrr = results.reduce((s, r) => s + r.mrr, 0) / results.length;
  const totalHits = results.reduce((s, r) => s + r.hits, 0);
  const totalExpected = results.reduce((s, r) => s + r.expectedCardTerms.length, 0);
  const recall = totalExpected > 0 ? totalHits / totalExpected : 0;

  console.log(`\n=== 检索评估汇总 ===`);
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  console.log(`平均 MRR: ${avgMrr.toFixed(3)}`);
  console.log(`Recall: ${totalHits}/${totalExpected} = ${(recall * 100).toFixed(1)}%`);

  if (fail > 0) {
    console.log("\n失败项:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  [${r.id}] ${r.question}`);
      r.failures.forEach((f) => console.log(`    - ${f}`));
    });
  }
}

main().catch(console.error).finally(() => db.$disconnect());
