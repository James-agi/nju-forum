import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { QuestionBox } from "@/components/knowledge/question-box";

export default async function KnowledgePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">NJU 知识问答</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          回答只来自已录入的知识卡片；没有充分依据时会明确拒答，并申请作者补充知识卡片。
        </p>
      </div>
      <QuestionBox />
    </div>
  );
}
