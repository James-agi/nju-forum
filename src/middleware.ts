import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import type { JWT } from "next-auth/jwt";
import {
  getApiBodyLimit,
  getTrustedClientIp,
  getWriteRateLimitRule,
} from "@/lib/security/request-policy";

const PUBLIC_API_PATHS = new Set(["/api/register", "/api/send-verification"]);
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/cron"];
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ADMIN_API_PREFIXES = ["/api/admin", "/api/knowledge/admin"];
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function isPublicApiRoute(pathname: string) {
  if (PUBLIC_API_PATHS.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizeNextDataPath(pathname: string) {
  if (!pathname.startsWith("/_next/data/")) return pathname;

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 4) return pathname;

  const routePath = `/${parts.slice(3).join("/")}`.replace(/\.json$/, "");
  return routePath === "/index" ? "/" : routePath;
}

function isAdminPagePath(pathname: string) {
  const effectivePathname = normalizeNextDataPath(pathname);
  return effectivePathname === "/admin" || effectivePathname.startsWith("/admin/");
}

function isAdminApiRoute(pathname: string) {
  return ADMIN_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isRscRequest(req: NextRequest) {
  return (
    req.headers.get("rsc") === "1" ||
    req.headers.get("next-router-prefetch") === "1" ||
    req.headers.get("accept")?.includes("text/x-component") ||
    req.nextUrl.searchParams.has("_rsc")
  );
}

function pruneRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size <= 10_000) return;

  rateLimitBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  });
}

function checkRateLimit(req: NextRequest, pathname: string) {
  if (req.method !== "POST") return null;

  const rule = getWriteRateLimitRule(pathname);
  if (!rule) return null;

  const now = Date.now();
  const key = `${rule.key}:${getTrustedClientIp(req.headers)}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    pruneRateLimitBuckets(now);
    return null;
  }

  if (bucket.count >= rule.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(rule.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
        },
      }
    );
  }

  bucket.count += 1;
  return null;
}

function rejectOversizedBody(req: NextRequest, pathname: string) {
  if (!pathname.startsWith("/api/") || !["POST", "PUT", "PATCH"].includes(req.method)) {
    return null;
  }

  const contentLength = Number.parseInt(req.headers.get("content-length") ?? "", 10);
  if (!Number.isFinite(contentLength) || contentLength <= getApiBodyLimit(pathname)) {
    return null;
  }
  return NextResponse.json({ error: "Request body too large" }, { status: 413 });
}

async function getSessionToken(req: NextRequest): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const token =
    (await getToken({ req, secret, secureCookie: false })) ??
    (await getToken({ req, secret, secureCookie: true }));

  return token;
}

async function hasSessionToken(req: NextRequest) {
  const token = await getSessionToken(req);
  return Boolean(token && !token.disabled && typeof token.id === "string");
}

async function isAdmin(req: NextRequest) {
  const token = await getSessionToken(req);
  return Boolean(
    token &&
      !token.disabled &&
      typeof token.id === "string" &&
      token.role === "ADMIN"
  );
}

function unauthorizedAdminResponse(req: NextRequest) {
  if (isRscRequest(req) || normalizeNextDataPath(req.nextUrl.pathname) !== req.nextUrl.pathname) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const publicBaseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    req.url;
  const loginUrl = new URL("/login", publicBaseUrl);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const oversizedResponse = rejectOversizedBody(req, pathname);
  if (oversizedResponse) return oversizedResponse;
  const rateLimitResponse = checkRateLimit(req, pathname);
  if (rateLimitResponse) return rateLimitResponse;

  if (isAdminPagePath(pathname)) {
    if (await isAdmin(req)) {
      return NextResponse.next();
    }
    return unauthorizedAdminResponse(req);
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isAdminApiRoute(pathname)) {
    if (await isAdmin(req)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
