import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface ActivePostSignal {
  id: string;
  recentReplyCount: number;
}

const ACTIVE_WINDOW_DAYS = 7;
export const DISCOVERY_POST_LIMIT = 4;

const POST_DISCOVERY_INCLUDE = {
  author: { select: { name: true } },
  section: { select: { id: true, name: true, icon: true } },
  _count: { select: { replies: true, favorites: true } },
} satisfies Prisma.PostInclude;

export type ForumDiscoveryPost = Prisma.PostGetPayload<{
  include: typeof POST_DISCOVERY_INCLUDE;
}> & {
  _recentReplyCount?: number;
};

export interface ForumDiscoveryPosts {
  activePosts: ForumDiscoveryPost[];
  hotPosts: ForumDiscoveryPost[];
}

export interface PostDiscoveryScope {
  sectionId?: string;
  tagName?: string;
  excludeIds?: string[];
}

function buildTagJoin(scope: PostDiscoveryScope = {}) {
  if (!scope.tagName) return Prisma.empty;
  return Prisma.sql`
    JOIN "_PostToTag" ON "_PostToTag"."A" = "Post"."id"
    JOIN "Tag" ON "Tag"."id" = "_PostToTag"."B"
  `;
}

function buildScopeWhere(scope: PostDiscoveryScope = {}) {
  const filters = [];
  if (scope.sectionId) {
    filters.push(Prisma.sql`"Post"."sectionId" = ${scope.sectionId}`);
  }
  if (scope.tagName) {
    filters.push(Prisma.sql`"Tag"."name" = ${scope.tagName}`);
  }
  if (scope.excludeIds?.length) {
    filters.push(Prisma.sql`"Post"."id" NOT IN (${Prisma.join(scope.excludeIds)})`);
  }
  if (filters.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(filters, " AND ")}`;
}

export async function recomputePostMetrics(postId: string) {
  try {
    await db.$executeRaw`
      UPDATE "Post"
      SET
        "favoriteCount" = (
          SELECT COUNT(*)::int FROM "Favorite" WHERE "Favorite"."postId" = ${postId}
        ),
        "replyCount" = (
          SELECT COUNT(*)::int FROM "Reply" WHERE "Reply"."postId" = ${postId}
        ),
        "lastReplyAt" = (
          SELECT MAX("createdAt") FROM "Reply" WHERE "Reply"."postId" = ${postId}
        )
      WHERE "id" = ${postId}
    `;

    await db.$executeRaw`
      UPDATE "Post"
      SET
        "hotScore" =
          "favoriteCount" * 3
          + "replyCount" * 2
          + LN("viewCount" + 1)
          + CASE
              WHEN "createdAt" > NOW() - (${ACTIVE_WINDOW_DAYS}::int * INTERVAL '1 day')
              THEN 10
              ELSE 0
            END,
        "activeScore" =
          CASE
            WHEN "lastReplyAt" IS NULL THEN 0
            ELSE
              "replyCount" * 4
              + "favoriteCount" * 2
              + LN("viewCount" + 1)
              + GREATEST(
                  0,
                  ${ACTIVE_WINDOW_DAYS}::double precision
                  - EXTRACT(EPOCH FROM (NOW() - "lastReplyAt")) / 86400
                )
          END
      WHERE "id" = ${postId}
    `;
  } catch (error) {
    console.warn("[post-metrics] recompute skipped:", error);
  }
}

export async function refreshAllPostMetrics() {
  await db.$executeRaw`
    UPDATE "Post"
    SET
      "favoriteCount" = COALESCE(favorites.count, 0),
      "replyCount" = COALESCE(replies.count, 0),
      "lastReplyAt" = replies."lastReplyAt"
    FROM (
      SELECT "postId", COUNT(*)::int AS count
      FROM "Favorite"
      GROUP BY "postId"
    ) favorites
    FULL OUTER JOIN (
      SELECT "postId", COUNT(*)::int AS count, MAX("createdAt") AS "lastReplyAt"
      FROM "Reply"
      GROUP BY "postId"
    ) replies
    ON favorites."postId" = replies."postId"
    WHERE "Post"."id" = COALESCE(favorites."postId", replies."postId")
  `;

  await db.$executeRaw`
    UPDATE "Post"
    SET
      "favoriteCount" = 0,
      "replyCount" = 0,
      "lastReplyAt" = NULL
    WHERE "id" NOT IN (
      SELECT "postId" FROM "Favorite"
      UNION
      SELECT "postId" FROM "Reply"
    )
  `;

  await db.$executeRaw`
    UPDATE "Post"
    SET
      "hotScore" =
        "favoriteCount" * 3
        + "replyCount" * 2
        + LN("viewCount" + 1)
        + CASE
            WHEN "createdAt" > NOW() - (${ACTIVE_WINDOW_DAYS}::int * INTERVAL '1 day')
            THEN 10
            ELSE 0
          END,
      "activeScore" =
        CASE
          WHEN "lastReplyAt" IS NULL THEN 0
          ELSE
            "replyCount" * 4
            + "favoriteCount" * 2
            + LN("viewCount" + 1)
            + GREATEST(
                0,
                ${ACTIVE_WINDOW_DAYS}::double precision
                - EXTRACT(EPOCH FROM (NOW() - "lastReplyAt")) / 86400
              )
        END
  `;
}

export async function recordPostView(postId: string) {
  try {
    await db.$executeRaw`
      UPDATE "Post"
      SET
        "viewCount" = "viewCount" + 1,
        "hotScore" =
          "favoriteCount" * 3
          + "replyCount" * 2
          + LN("viewCount" + 2)
          + CASE
              WHEN "createdAt" > NOW() - (${ACTIVE_WINDOW_DAYS}::int * INTERVAL '1 day')
              THEN 10
              ELSE 0
            END,
        "activeScore" =
          CASE
            WHEN "lastReplyAt" IS NULL THEN 0
            ELSE
              "replyCount" * 4
              + "favoriteCount" * 2
              + LN("viewCount" + 2)
              + GREATEST(
                  0,
                  ${ACTIVE_WINDOW_DAYS}::double precision
                  - EXTRACT(EPOCH FROM (NOW() - "lastReplyAt")) / 86400
                )
          END
      WHERE "id" = ${postId}
    `;
  } catch (error) {
    console.warn("[post-metrics] view metric update skipped:", error);
    try {
      await db.post.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
      });
    } catch (fallbackError) {
      console.warn("[post-metrics] view count fallback skipped:", fallbackError);
    }
  }
}


export async function getActivePostSignals(
  limit = 4,
  scope: PostDiscoveryScope = {}
): Promise<ActivePostSignal[] | null> {
  try {
    const rows = await db.$queryRaw<Array<{ id: string; recentReplyCount: number | bigint }>>`
      SELECT
        "Post"."id",
        COUNT("Reply"."id")::int AS "recentReplyCount"
      FROM "Post"
      ${buildTagJoin(scope)}
      LEFT JOIN "Reply"
        ON "Reply"."postId" = "Post"."id"
        AND "Reply"."createdAt" >= NOW() - (${ACTIVE_WINDOW_DAYS}::int * INTERVAL '1 day')
      WHERE "Post"."lastReplyAt" >= NOW() - (${ACTIVE_WINDOW_DAYS}::int * INTERVAL '1 day')
      ${buildScopeWhere(scope)}
      GROUP BY "Post"."id"
      ORDER BY
        "Post"."activeScore" DESC,
        "Post"."lastReplyAt" DESC,
        "Post"."createdAt" DESC,
        "Post"."id" DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      id: row.id,
      recentReplyCount: Number(row.recentReplyCount),
    }));
  } catch {
    return null;
  }
}

export async function getHotPostIds(
  limit = 4,
  scope: PostDiscoveryScope = {}
): Promise<string[] | null> {
  try {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "Post"."id"
      FROM "Post"
      ${buildTagJoin(scope)}
      WHERE 1 = 1
      ${buildScopeWhere(scope)}
      ORDER BY "Post"."hotScore" DESC, "Post"."createdAt" DESC, "Post"."id" DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => row.id);
  } catch {
    return null;
  }
}

async function getPostsByOrderedIds(
  ids: string[],
  recentReplyCounts?: Map<string, number>
): Promise<ForumDiscoveryPost[]> {
  if (ids.length === 0) return [];

  const posts = await db.post.findMany({
    where: { id: { in: ids } },
    include: POST_DISCOVERY_INCLUDE,
  });
  const indexById = new Map(ids.map((id, index) => [id, index]));

  return posts
    .map((post) => ({
      ...post,
      _recentReplyCount: recentReplyCounts?.get(post.id) ?? 0,
    }))
    .sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0));
}

async function getFallbackActivePosts(
  where: Prisma.PostWhereInput,
  limit: number
): Promise<ForumDiscoveryPost[]> {
  const recentReplies = await db.reply.findMany({
    where: { createdAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400_000) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { postId: true, createdAt: true },
  });

  const activityByPost = new Map<string, { count: number; lastReplyAt: Date }>();
  for (const reply of recentReplies) {
    const current = activityByPost.get(reply.postId);
    if (!current) {
      activityByPost.set(reply.postId, { count: 1, lastReplyAt: reply.createdAt });
      continue;
    }
    current.count += 1;
    if (reply.createdAt > current.lastReplyAt) current.lastReplyAt = reply.createdAt;
  }

  const activePostIds = Array.from(activityByPost.keys()).slice(0, 30);
  if (activePostIds.length === 0) return [];

  const candidates = await db.post.findMany({
    where: { ...where, id: { in: activePostIds } },
    include: POST_DISCOVERY_INCLUDE,
  });

  return candidates
    .map((post) => {
      const activity = activityByPost.get(post.id);
      const lastReplyAt = activity?.lastReplyAt ?? post.createdAt;
      const ageDays = Math.max(0, (Date.now() - lastReplyAt.getTime()) / 86400_000);
      const recencyBoost = Math.max(0, ACTIVE_WINDOW_DAYS - ageDays);
      return {
        ...post,
        _recentReplyCount: activity?.count ?? 0,
        _activeScore:
          (activity?.count ?? 0) * 4 +
          post._count.favorites * 2 +
          Math.log1p(post.viewCount) +
          recencyBoost,
        _lastReplyAt: lastReplyAt,
      };
    })
    .sort(
      (a, b) =>
        b._activeScore - a._activeScore ||
        b._lastReplyAt.getTime() - a._lastReplyAt.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id)
    )
    .slice(0, limit);
}

async function getFallbackHotPosts(
  where: Prisma.PostWhereInput,
  excludeIds: Set<string>,
  limit: number
): Promise<ForumDiscoveryPost[]> {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400_000);
  const posts = await db.post.findMany({
    where,
    take: 30,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: POST_DISCOVERY_INCLUDE,
  });

  return posts
    .filter((post) => !excludeIds.has(post.id))
    .map((post) => ({
      ...post,
      _score:
        post._count.favorites * 3 +
        post._count.replies * 2 +
        (post.createdAt > activeSince ? 10 : 0),
    }))
    .sort(
      (a, b) =>
        b._score - a._score ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id)
    )
    .slice(0, limit);
}

export async function getForumDiscoveryPosts({
  enabled,
  where = {},
  scope = {},
  limit = DISCOVERY_POST_LIMIT,
}: {
  enabled: boolean;
  where?: Prisma.PostWhereInput;
  scope?: PostDiscoveryScope;
  limit?: number;
}): Promise<ForumDiscoveryPosts> {
  if (!enabled) return { activePosts: [], hotPosts: [] };

  const activeSignals = await getActivePostSignals(limit, scope);
  const activePosts = activeSignals
    ? await getPostsByOrderedIds(
        activeSignals.map((item) => item.id),
        new Map(activeSignals.map((item) => [item.id, item.recentReplyCount]))
      )
    : await getFallbackActivePosts(where, limit);

  const activePostIdSet = new Set(activePosts.map((post) => post.id));
  const hotPostIds =
    (await getHotPostIds(limit * 2, {
      ...scope,
      excludeIds: Array.from(activePostIdSet),
    }))
      ?.filter((id) => !activePostIdSet.has(id))
      .slice(0, limit) ?? null;
  const hotPosts = hotPostIds
    ? await getPostsByOrderedIds(hotPostIds)
    : await getFallbackHotPosts(where, activePostIdSet, limit);

  return { activePosts, hotPosts };
}
