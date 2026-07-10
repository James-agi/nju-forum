import { describe, expect, it } from "vitest";
import {
  getApiBodyLimit,
  getTrustedClientIp,
  getWriteRateLimitRule,
} from "@/lib/security/request-policy";

describe("request policy", () => {
  it("uses the proxy-appended rightmost client address", () => {
    const headers = new Headers({
      "x-forwarded-for": "spoofed, 203.0.113.8",
      "x-real-ip": "203.0.113.8",
    });
    expect(getTrustedClientIp(headers)).toBe("203.0.113.8");
  });

  it("shares one reply rate bucket across post ids", () => {
    expect(getWriteRateLimitRule("/api/posts/a/replies")?.key).toBe("reply-create");
    expect(getWriteRateLimitRule("/api/posts/b/replies")?.key).toBe("reply-create");
  });

  it("allows larger multipart endpoints without raising the JSON limit", () => {
    expect(getApiBodyLimit("/api/forum/images")).toBe(20 * 1024 * 1024);
    expect(getApiBodyLimit("/api/posts")).toBe(1024 * 1024);
  });
});
