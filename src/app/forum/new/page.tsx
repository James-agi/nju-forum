import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { NewPostForm } from "@/components/forum/new-post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PenSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const sections = await db.section.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      icon: true,
      description: true,
    },
  });

  const tagsRaw = await db.tag.findMany({
    include: { _count: { select: { posts: true } } },
    orderBy: { posts: { _count: "desc" } },
    take: 30,
  });
  const existingTags = tagsRaw.map((t) => t.name);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/forum">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回论坛
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenSquare className="h-5 w-5" />
                发布帖子
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NewPostForm sections={sections} existingTags={existingTags} />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">可选分区</h2>
            <div className="grid gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className="rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-foreground/20"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span>{section.icon || "📌"}</span>
                    <span>{section.name}</span>
                  </div>
                  {section.description && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {section.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
