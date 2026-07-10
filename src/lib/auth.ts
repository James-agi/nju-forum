import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { applyCurrentUserToToken, applyTokenToSession } from "@/lib/auth-token";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string") {
          return null;
        }
        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;
        if (!email || email.length > 254 || !password || password.length > 128) return null;

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || user.banned) return null;

        const isPasswordValid = await compare(
          password,
          user.password
        );

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        if (typeof user.id === "string") {
          token.id = user.id;
        }
        token.role = (user as { role: string }).role;
        token.avatar = (user as { avatar: string | null }).avatar;
        token.disabled = false;
      }
      // 客户端 useSession().update({ avatar }) 时同步进 token，头像即时刷新
      if (
        trigger === "update" &&
        session &&
        typeof session === "object" &&
        "avatar" in session
      ) {
        token.avatar = (session as { avatar: string | null }).avatar;
      }

      if (typeof token.id === "string") {
        const currentUser = await db.user.findUnique({
          where: { id: token.id },
          select: { role: true, avatar: true, banned: true },
        });

        applyCurrentUserToToken(token, currentUser);
      }

      return token;
    },
    async session({ session, token }) {
      return applyTokenToSession(session, token);
    },
  },
});
