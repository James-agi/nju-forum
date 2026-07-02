import { SectionLabel } from "@/components/ui/section-label";
import { QuestionBox } from "@/components/knowledge/question-box";

export default async function KnowledgePage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <SectionLabel
          en="Knowledge · 知识问答"
          zh="NJU 知识问答"
        />
        <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
          回答只来自已录入的知识卡片；没有充分依据时会明确拒答，并申请作者补充知识卡片。
        </p>
      </div>
      <QuestionBox />
    </div>
  );
}
