import { STOP } from "@/lib/knowledge/lexicon";

type JiebaLike = { cut(text: string, hmm?: boolean): string[] };
let jiebaInstance: JiebaLike | null | undefined;

async function getJieba(): Promise<JiebaLike | null> {
  if (jiebaInstance !== undefined) return jiebaInstance;
  try {
    const m = (await import("@node-rs/jieba")) as { Jieba: new () => JiebaLike };
    jiebaInstance = new m.Jieba();
  } catch {
    jiebaInstance = null;
  }
  return jiebaInstance;
}

function ngramFallback(text: string): string[] {
  const chunks = text.match(/[0-9a-zA-Z\u3400-\u9fff]{2,}/g) ?? [];
  const tokens = new Set<string>();

  for (const c of chunks) {
    if (!STOP.has(c)) tokens.add(c);
    if (/[\u3400-\u9fff]/.test(c) && c.length > 3) {
      for (let s = 2; s <= Math.min(5, c.length); s++) {
        for (let i = 0; i <= c.length - s; i++) {
          const g = c.slice(i, i + s);
          if (!STOP.has(g)) tokens.add(g);
        }
      }
    }
  }

  return Array.from(tokens);
}

export async function tokenize(text: string): Promise<string[]> {
  const jieba = await getJieba();
  if (!jieba) return ngramFallback(text);

  const words = jieba.cut(text, true);
  return words
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2 && !STOP.has(w));
}
