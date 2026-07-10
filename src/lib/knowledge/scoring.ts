import type { RetrievalCard } from "@/lib/knowledge/types-internal";
import { GENERIC, SPEC } from "@/lib/knowledge/lexicon";

export function isSpec(t: string): boolean {
  const n = t.toLowerCase();
  if (GENERIC.has(n)) return false;
  if (SPEC.has(n)) return true;
  if (/[\u3400-\u9fff]/.test(n) && n.length >= 2) return true;
  if (/^[a-z0-9]{2,}$/i.test(n)) return true;
  return n.length >= 3;
}

function scTerm(t: string, f: string): number {
  if (!isSpec(t)) return f === "summary" ? 1 : 0;
  if (f === "summary") return t.length >= 5 ? 7 : t.length >= 3 ? 5 : 3;
  if (f === "body") return t.length >= 5 ? 5 : t.length >= 3 ? 3 : 2;
  if (f === "domain") return t.length >= 3 ? 2 : 1;
  return 1;
}

export function scoreCard(card: RetrievalCard, terms: string[]): { score: number; matchedTerms: string[] } {
  const sm = card.summary.toLowerCase();
  const bd = card.body.toLowerCase();
  const ex = (card.sourceExcerpt ?? "").toLowerCase();
  const dm = card.domainTag.toLowerCase();
  const sd = card.sourceDescription.toLowerCase();
  const mt: string[] = [];
  let sc = 0;

  for (const t of terms) {
    const nt = t.toLowerCase();
    let m = false;

    if (sm.includes(nt)) {
      sc += scTerm(nt, "summary");
      m = true;
    }
    if (bd.includes(nt)) {
      sc += scTerm(nt, "body");
      m = true;
    }
    if (ex.includes(nt)) {
      sc += scTerm(nt, "excerpt");
      m = true;
    }
    if (dm.includes(nt)) {
      sc += scTerm(nt, "domain");
      m = true;
    }
    if (sd.includes(nt)) {
      sc += scTerm(nt, "source");
      m = true;
    }

    if (m) mt.push(t);
  }

  if (mt.length > 0) {
    if (card.verificationStatus === "VERIFIED") sc += 1;
    if (card.verificationStatus === "NEEDS_REVIEW") sc -= 1;
    if (card.sourceType === "OFFICIAL") sc += 1;
  }

  return { score: Math.max(0, sc), matchedTerms: Array.from(new Set(mt)) };
}
