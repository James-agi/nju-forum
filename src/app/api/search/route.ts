import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";
import { searchForum } from "@/lib/forum/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ posts: [], users: [] });

  const result = await searchForum(q, {
    isAdmin: session.user.role === "ADMIN",
  });
  return NextResponse.json(result);
}
