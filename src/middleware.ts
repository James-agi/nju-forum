import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API_PATHS = new Set(["/api/register", "/api/send-verification"]);
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/cron"];
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublicApiRoute(pathname: string) {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function hasSessionToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const token =
    (await getToken({ req, secret, secureCookie: false })) ??
    (await getToken({ req, secret, secureCookie: true }));

  return Boolean(token);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname) || READ_ONLY_METHODS.has(req.method)) {
    return NextResponse.next();
  }

  if (await hasSessionToken(req)) {
    return NextResponse.next();
  }

  return NextResponse.json({ error: "请先登录" }, { status: 401 });
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
