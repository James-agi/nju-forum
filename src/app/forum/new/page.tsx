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
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/forum">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回论坛
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenSquare className="h-5 w-5" />
              发布帖子
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              先选最贴近内容的分区；分区说明会在选择时展示，标签可用来补充更具体的话题。
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-6 sm:px-6 lg:px-8">
            <NewPostForm sections={sections} existingTags={existingTags} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
