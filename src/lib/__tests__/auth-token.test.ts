import { describe, expect, it } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { applyCurrentUserToToken, applyTokenToSession } from "@/lib/auth-token";

function session(): Session {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: { id: "user-1", role: "ADMIN", avatar: null },
  };
}

describe("auth token state", () => {
  it.each([null, { role: "ADMIN", avatar: null, banned: true }])(
    "invalidates a deleted or banned account",
    (currentUser) => {
      const token = applyCurrentUserToToken(
        { id: "user-1", role: "ADMIN" } as JWT,
        currentUser
      );
      expect(token.disabled).toBe(true);
      expect(token.role).toBeUndefined();
      expect(applyTokenToSession(session(), token).user).toBeUndefined();
    }
  );

  it("refreshes a demoted role from the database", () => {
    const token = applyCurrentUserToToken(
      { id: "user-1", role: "ADMIN" } as JWT,
      { role: "USER", avatar: null, banned: false }
    );
    expect(applyTokenToSession(session(), token).user?.role).toBe("USER");
  });
});
