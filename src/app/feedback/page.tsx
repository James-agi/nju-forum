import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-utils";
import { SectionLabel } from "@/components/ui/section-label";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <SectionLabel en="Feedback · 意见反馈" zh="意见反馈" />
      <p className="mt-3 text-sm text-muted-foreground">
        知南还在打磨中，遇到任何问题、有想法，或者愿意提供资料帮助资料库迭代，都欢迎告诉我们。
      </p>
      <div className="mt-8 animate-fade-in">
        <FeedbackForm />
      </div>
    </div>
  );
}
