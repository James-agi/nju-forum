import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { tokenize } from "@/lib/knowledge/tokenizer";

export interface SearchedPost {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: Date;
  author: { name: string };
  section: { id: string; name: string; icon: string | null } | null;
  tags: Array<{ id: string; name: string }>;
  _count: { replies: number; favorites: number };
}

export interface SearchedUser {
  id: string;
  name: string;
  avatar: string | null;
  _count: { posts: number };
}

export interface ForumSearchResult {
  posts: SearchedPost[];
  users: SearchedUser[];
}

// 注：当前数据量下用 ILIKE(`contains`) 顺扫足够；数据增长后可加 pg_trgm/GIN 索引或 tsvector。
export async function searchForum(
  query: string,
  opts: { isAdmin?: boolean } = {}
): Promise<ForumSearchResult> {
  const q = query.trim();
  if (!q) return { posts: [], users: [] };

  const tokens = await tokenize(q);
  // 始终把整串查询也作为一个词（保证精确子串命中），再并入分词结果。
  const terms = Array.from(new Set([q.toLowerCase(), ...tokens]))
    .filter((t) => t.length >= 1)
    .slice(0, 12);

  const postOr: Prisma.PostWhereInput[] = terms.flatMap((t) => [
    { title: { contains: t, mode: "insensitive" } },
    { content: { contains: t, mode: "insensitive" } },
    { tags: { some: { name: { contains: t, mode: "insensitive" } } } },
  ]);

  const rawPosts = await db.post.findMany({
    where: { OR: postOr },
    take: 40,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { name: true } },
      section: { select: { id: true, name: true, icon: true } },
      tags: { select: { id: true, name: true } },
      _count: { select: { replies: true, favorites: true } },
    },
  });

  // 轻量命中度重排：标题命中权重高于正文。
  const posts = rawPosts
    .map((p) => {
      const titleLow = p.title.toLowerCase();
      const bodyLow = p.content.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (titleLow.includes(t)) score += 3;
        if (bodyLow.includes(t)) score += 1;
      }
      return { p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s) => s.p);

  const userOr: Prisma.UserWhereInput[] = terms.flatMap((t) => {
    const arr: Prisma.UserWhereInput[] = [
      { name: { contains: t, mode: "insensitive" } },
    ];
    if (opts.isAdmin) {
      arr.push({ email: { contains: t, mode: "insensitive" } });
    }
    return arr;
  });

  const users = await db.user.findMany({
    where: { banned: false, OR: userOr },
    take: 10,
    select: {
      id: true,
      name: true,
      avatar: true,
      _count: { select: { posts: true } },
    },
  });

  return { posts, users };
}
