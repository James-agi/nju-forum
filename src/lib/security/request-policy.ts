type HeaderReader = Pick<Headers, "get">;

export type WriteRateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

const MINUTE = 60_000;

const EXACT_WRITE_RULES = new Map<string, WriteRateLimitRule>([
  ["/api/auth/callback/credentials", { key: "login", limit: 5, windowMs: MINUTE }],
  ["/api/register", { key: "register", limit: 5, windowMs: MINUTE }],
  ["/api/send-verification", { key: "verification", limit: 5, windowMs: MINUTE }],
  ["/api/posts", { key: "post-create", limit: 10, windowMs: 10 * MINUTE }],
  ["/api/forum/images", { key: "forum-images", limit: 10, windowMs: 10 * MINUTE }],
  ["/api/user/avatar", { key: "avatar", limit: 5, windowMs: 10 * MINUTE }],
  ["/api/feedback", { key: "feedback", limit: 5, windowMs: 10 * MINUTE }],
  ["/api/favorites", { key: "favorites", limit: 60, windowMs: 10 * MINUTE }],
  ["/api/knowledge/source-images", { key: "source-images", limit: 10, windowMs: 10 * MINUTE }],
  ["/api/knowledge/card-batches/run", { key: "card-batch-run", limit: 5, windowMs: 10 * MINUTE }],
]);

export function getTrustedClientIp(headers: HeaderReader) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const addresses = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (addresses.length > 0) return addresses.at(-1)!;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function getWriteRateLimitRule(pathname: string) {
  const exact = EXACT_WRITE_RULES.get(pathname);
  if (exact) return exact;
  if (/^\/api\/posts\/[^/]+\/replies$/.test(pathname)) {
    return { key: "reply-create", limit: 20, windowMs: 10 * MINUTE };
  }
  if (/^\/api\/knowledge\/card-batches\/[^/]+$/.test(pathname)) {
    return { key: "card-batch-update", limit: 20, windowMs: 10 * MINUTE };
  }
  return null;
}

export function getApiBodyLimit(pathname: string) {
  if (
    pathname === "/api/forum/images" ||
    pathname === "/api/feedback" ||
    pathname === "/api/user/avatar"
  ) {
    return 20 * 1024 * 1024;
  }
  return 1024 * 1024;
}
