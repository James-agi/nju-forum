import { normalizeQuestionText } from "@/lib/knowledge/validation";
import { tokenize } from "@/lib/knowledge/tokenizer";
import { SPEC, STOP, ALIAS } from "@/lib/knowledge/lexicon";

export type RetrievalTermSource = "SPEC" | "TOKENIZER" | "ALIAS";
export type AliasDecisionStatus = "APPLIED" | "REJECTED";
export type AliasRejectReason = "MISSING_CONTEXT" | "BLOCKED";

export interface RetrievalTermTrace {
  terms: string[];
  sources: Array<{
    term: string;
    source: RetrievalTermSource;
    detail?: string;
  }>;
  aliases: Array<{
    triggers: string[];
    matchedTriggers: string[];
    targets: string[];
    status: AliasDecisionStatus;
    reason?: AliasRejectReason;
    requireAny?: string[];
    blockAny?: string[];
  }>;
}

function includesAny(text: string, terms?: string[]) {
  return !terms || terms.some((term) => text.includes(term.toLowerCase()));
}

function uniqueSortedTerms(terms: Set<string>) {
  const arr = Array.from(terms)
    .filter((s) => s.length >= 2)
    .sort((a, b) => b.length - a.length);

  const spec = arr.filter((s) => SPEC.has(s));
  const rest = arr.filter((s) => !SPEC.has(s));

  return spec.concat(rest).slice(0, 15);
}

export async function analyzeRetrievalTerms(question: string): Promise<RetrievalTermTrace> {
  const n = normalizeQuestionText(question);
  const t = new Set<string>();
  const sources: RetrievalTermTrace["sources"] = [];
  const aliases: RetrievalTermTrace["aliases"] = [];

  Array.from(SPEC).forEach((s) => {
    if (n.includes(s.toLowerCase())) {
      t.add(s);
      sources.push({ term: s, source: "SPEC" });
    }
  });

  const words = await tokenize(n);
  for (const w of words) {
    if (w.length >= 2 && !STOP.has(w)) {
      t.add(w);
      sources.push({ term: w, source: "TOKENIZER" });
    }
  }

  ALIAS.forEach((a) => {
    const matchedTriggers = a.k.filter((k) => n.includes(k.toLowerCase()));
    if (matchedTriggers.length === 0) return;

    const decision = {
      triggers: a.k,
      matchedTriggers,
      targets: a.t,
      requireAny: a.requireAny,
      blockAny: a.blockAny,
    };

    if (!includesAny(n, a.requireAny)) {
      aliases.push({ ...decision, status: "REJECTED", reason: "MISSING_CONTEXT" });
      return;
    }

    if (a.blockAny?.some((term) => n.includes(term.toLowerCase()))) {
      aliases.push({ ...decision, status: "REJECTED", reason: "BLOCKED" });
      return;
    }

    aliases.push({ ...decision, status: "APPLIED" });
    a.t.forEach((s) => {
      t.add(s);
      sources.push({ term: s, source: "ALIAS", detail: matchedTriggers.join(" / ") });
    });
  });

  return {
    terms: uniqueSortedTerms(t),
    sources,
    aliases,
  };
}

export async function extractRetrievalTerms(question: string): Promise<string[]> {
  return (await analyzeRetrievalTerms(question)).terms;
}
