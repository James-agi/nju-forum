import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-utils";

export interface KnowledgeApiUser {
  id: string;
  role: string;
  banned: boolean;
}

export type AuthzResult =
  | { ok: true; user: KnowledgeApiUser }
  | { ok: false; response: NextResponse };

export type KnowledgeGuestAuthzResult =
  | { ok: true; user: KnowledgeApiUser | null }
  | { ok: false; response: NextResponse };

export async function requireKnowledgeUser(): Promise<AuthzResult> {
  const session = await getSession();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "请先登录" }, { status: 401 }),
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, banned: true },
  });

  if (!user || user.banned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "账号不可用" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}

export async function allowKnowledgeGuest(): Promise<KnowledgeGuestAuthzResult> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: true, user: null };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, banned: true },
  });

  if (!user || user.banned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "账号不可用" }, { status: 403 }),
    };
  }

  return { ok: true, user };
}

export async function requireKnowledgeAuthor(): Promise<AuthzResult> {
  const result = await requireKnowledgeUser();
  if (!result.ok) return result;

  if (result.user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "只有 ADMIN 作者可以管理知识库" }, { status: 403 }),
    };
  }

  return result;
}
