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
}
