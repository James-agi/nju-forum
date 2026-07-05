import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";
import {
  encodePostContent,
  normalizePostContentFormat,
} from "@/lib/forum/content-format";

const MAX_POST_IMAGES = 6;
const MAX_TAGS = 10;
const FORUM_IMAGE_PATTERN = /^\/forum-images\/[A-Za-z0-9._~/%-]+$/;

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => FORUM_IMAGE_PATTERN.test(item))
    .slice(0, MAX_POST_IMAGES);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);
}

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

    const payload = await req.json();
    const { title, content, sectionId } = payload;
    const normalizedTitle = typeof title === "string" ? title.trim() : "";
    const normalizedContent = typeof content === "string" ? content : "";
    const normalizedSectionId = typeof sectionId === "string" ? sectionId : "";
    const contentFormat = normalizePostContentFormat(payload.contentFormat);
    const images = normalizeImages(payload.images);
    const tags = normalizeTags(payload.tags);

    if (!normalizedTitle || !normalizedSectionId || (!normalizedContent.trim() && images.length === 0)) {
      return NextResponse.json({ error: "请填写标题、分区，并输入内容或添加图片" }, { status: 400 });
    }

    const section = await db.section.findUnique({ where: { id: normalizedSectionId } });
    if (!section) {
      return NextResponse.json({ error: "分区不存在" }, { status: 400 });
    }

    const tagRecords = tags.length
      ? await Promise.all(
          tags.map(async (tagName) => {
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
        title: normalizedTitle,
        content: encodePostContent(normalizedContent, contentFormat),
        images,
        sectionId: normalizedSectionId,
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
