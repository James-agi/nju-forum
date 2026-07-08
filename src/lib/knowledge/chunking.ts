import type { RetrievalCard } from "@/lib/knowledge/types-internal";

export interface CardTextChunk {
  chunkId: string;
  cardId: string;
  index: number;
  text: string;
  sectionTitle?: string;
}

const MAX_CHUNK_LENGTH = 520;
const MIN_CHUNK_LENGTH = 12;

function compact(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function detectSectionTitle(block: string) {
  const firstLine = block.split("\n").map((line) => line.trim()).find(Boolean) || "";
  const markdown = firstLine.match(/^#{1,6}\s+(.+)$/);
  if (markdown) return markdown[1].trim();

  const bracket = firstLine.match(/^【([^】]+)】/);
  if (bracket) return bracket[1].trim();

  const bold = firstLine.match(/^\*\*([^*：:]{2,40})\*\*[：:]?/);
  if (bold) return bold[1].trim();

  return undefined;
}

function splitLongBlock(text: string) {
  if (text.length <= MAX_CHUNK_LENGTH) return [text];

  const pieces = text
    .split(/(?<=[。！？!?；;])\s+|(?=\n\s*[-*]\s+)/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";

  for (const piece of pieces.length > 0 ? pieces : [text]) {
    if (!buffer) {
      buffer = piece;
      continue;
    }
    if (`${buffer}\n${piece}`.length > MAX_CHUNK_LENGTH) {
      chunks.push(buffer);
      buffer = piece;
    } else {
      buffer = `${buffer}\n${piece}`;
    }
  }
  if (buffer) chunks.push(buffer);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= MAX_CHUNK_LENGTH * 1.25) return [chunk];
    const sliced: string[] = [];
    for (let i = 0; i < chunk.length; i += MAX_CHUNK_LENGTH) {
      sliced.push(chunk.slice(i, i + MAX_CHUNK_LENGTH));
    }
    return sliced;
  });
}

export function chunkKnowledgeCard(card: RetrievalCard): CardTextChunk[] {
  const body = compact(card.body);
  if (!body) return [];

  const blocks = body
    .split(/\n{2,}|(?=\n?\s*#{1,6}\s+)|(?=\n?\s*【[^】]+】)/)
    .map((block) => compact(block))
    .filter((block) => block.length >= MIN_CHUNK_LENGTH);

  const rawChunks = (blocks.length > 0 ? blocks : [body]).flatMap((block) => {
    const sectionTitle = detectSectionTitle(block);
    return splitLongBlock(block).map((text) => ({ text, sectionTitle }));
  });

  return rawChunks.map((chunk, index) => ({
    chunkId: `${card.id}#chunk-${index + 1}`,
    cardId: card.id,
    index,
    text: chunk.text,
    sectionTitle: chunk.sectionTitle,
  }));
}
