import { KnowledgeCardsPage as KnowledgeCardsClientPage } from "@/components/knowledge/knowledge-cards-page";
import { requireKnowledgePageUser } from "@/lib/knowledge/page-auth";

export const dynamic = "force-dynamic";

export default async function KnowledgeCardsPage() {
  await requireKnowledgePageUser();

  return <KnowledgeCardsClientPage />;
}
