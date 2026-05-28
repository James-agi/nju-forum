import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("sectionId");
    const sort = searchParams.get("sort") || "latest";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 20;
    const skip = (page - 1) * limit;

    const where = sectionId ? { sectionId } : {};
    const orderBy =
      sort === "hot"
        ? [{ viewCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ pinned: "desc" as const }, { createdAt: "desc" as const }];

    const [posts, total] = await Promise.all([
      db.post.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          section: { select: { id: true, name: true, icon: true } },
          tags: { select: { id: true, name: true } },
          _count: { select: { replies: true, favorites: true } },
        },
      }),
      db.post.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json({ error: "获取帖子失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.banned) {
      return NextResponse.json({ error: "账号已被封禁" }, { status: 403 });
    }

    const { title, content, sectionId, tags } = await req.json();

    if (!title?.trim() || !content?.trim() || !sectionId) {
      return NextResponse.json({ error: "请填写所有必填字段" }, { status: 400 });
    }

    const section = await db.section.findUnique({ where: { id: sectionId } });
    if (!section) {
      return NextResponse.json({ error: "分区不存在" }, { status: 400 });
    }

    const tagRecords = tags?.length
      ? await Promise.all(
          tags.map(async (tagName: string) => {
            return db.tag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName },
            });
          })
        )
      : [];

    const post = await db.post.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        sectionId,
        authorId: session.user.id,
        tags: tagRecords.length > 0 ? { connect: tagRecords.map((t) => ({ id: t.id })) } : undefined,
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json({ error: "发帖失败" }, { status: 500 });
  }
}
