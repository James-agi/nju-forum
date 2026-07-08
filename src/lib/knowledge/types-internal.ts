import type { KnowledgeCard } from "@prisma/client";

export type RetrievalCard = Pick<
  KnowledgeCard,
  | "id" | "summary" | "body" | "sourceExcerpt" | "sourceUrl" | "sourceDescription"
  | "sourceType" | "verificationStatus" | "domainTag" | "createdAt" | "updatedAt" | "archivedAt"
>;

export interface RetrievalResult {
  card: RetrievalCard;
  score: number;
  matchedTerms: string[];
  question?: string;
  queryTerms?: string[];
  originalQueryTerms?: string[];
  evidenceChunks?: EvidenceChunk[];
}

export interface EvidenceChunk {
  chunkId: string;
  cardId: string;
  index: number;
  text: string;
  sectionTitle?: string;
  score: number;
  matchedTerms: string[];
}
