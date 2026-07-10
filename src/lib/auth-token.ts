import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export type CurrentTokenUser = {
  role: string;
  avatar: string | null;
  banned: boolean;
};

export function applyCurrentUserToToken(
  token: JWT,
  currentUser: CurrentTokenUser | null
) {
  if (currentUser && !currentUser.banned) {
    token.role = currentUser.role;
    token.avatar = currentUser.avatar;
    token.disabled = false;
  } else {
    token.role = undefined;
    token.avatar = null;
    token.disabled = true;
  }
  return token;
}

export function applyTokenToSession(session: Session, token: JWT) {
  if (token.disabled || typeof token.id !== "string" || typeof token.role !== "string") {
    delete (session as unknown as { user?: unknown }).user;
    return session;
  }

  if (session.user) {
    session.user.id = token.id;
    session.user.role = token.role;
    session.user.avatar = token.avatar ?? null;
  }
  return session;
}
