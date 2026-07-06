import { normalizeQuestionText } from "@/lib/knowledge/validation";
import { tokenize } from "@/lib/knowledge/tokenizer";
import { SPEC, STOP, ALIAS } from "@/lib/knowledge/lexicon";

export async function extractRetrievalTerms(question: string): Promise<string[]> {
  const n = normalizeQuestionText(question);
  const t = new Set<string>();

  Array.from(SPEC).forEach((s) => {
    if (n.includes(s)) t.add(s);
  });

  const words = await tokenize(n);
  for (const w of words) {
    if (w.length >= 2 && !STOP.has(w)) t.add(w);
  }

  ALIAS.forEach((a) => {
    if (a.k.some((k) => n.includes(k))) a.t.forEach((s) => t.add(s));
  });

  const arr = Array.from(t)
    .filter((s) => s.length >= 2)
    .sort((a, b) => b.length - a.length);

  const spec = arr.filter((s) => SPEC.has(s));
  const rest = arr.filter((s) => !SPEC.has(s));

  return spec.concat(rest).slice(0, 15);
}
