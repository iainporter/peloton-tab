import NextAuth, { type Session } from "next-auth";
import { cache } from "react";
import Strava from "./strava-provider";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Whether the user behind a session still has an active account. Cached per
 * request, since layouts and pages both call auth().
 */
const isActiveUser = cache(async (userId: string | undefined) => {
  if (!userId) return false;

  try {
    const [user] = await db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return !!user && !user.deletedAt;
  } catch (error) {
    // Fail open: a database hiccup shouldn't sign everyone out
    console.error("Session user check failed:", error);
    return true;
  }
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: [Strava()],
  callbacks: {
    async jwt({ token, account, profile }) {
      // First-time login — persist user and store tokens in JWT
      if (account && profile) {
        const stravaId = Number(profile.id);
        const name = `${(profile as any).firstname} ${(profile as any).lastname}`;
        const avatarUrl =
          (profile as any).profile_medium || (profile as any).profile || null;

        // Upsert user in database
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.stravaId, stravaId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(users)
            .set({
              name,
              avatarUrl,
              stravaAccessToken: account.access_token!,
              stravaRefreshToken: account.refresh_token!,
              stravaTokenExpiresAt: new Date(account.expires_at! * 1000),
            })
            .where(eq(users.stravaId, stravaId));

          token.userId = existing[0].id;
        } else {
          const [newUser] = await db
            .insert(users)
            .values({
              stravaId,
              name,
              avatarUrl,
              stravaAccessToken: account.access_token!,
              stravaRefreshToken: account.refresh_token!,
              stravaTokenExpiresAt: new Date(account.expires_at! * 1000),
            })
            .returning({ id: users.id });

          token.userId = newUser.id;
        }

        token.stravaId = stravaId;
        token.accessToken = account.access_token!;
        token.refreshToken = account.refresh_token!;
        token.expiresAt = account.expires_at!;
        token.name = name;
        token.picture = avatarUrl;
      }

      // Token refresh is NOT done here. Next.js 16 doesn't allow cookies to
      // be modified in Server Components or Middleware, and Auth.js updates the
      // session cookie whenever the JWT changes. All Strava API calls use
      // getFreshAccessToken() (src/lib/strava.ts) which refreshes from the DB.

      return token;
    },

    async session({ session, token }) {
      // Sessions are JWTs, so another device stays signed in after the account
      // is deleted. Reject sessions for missing or deleted users. Returning null
      // doesn't work server-side (next-auth falls back to a default session),
      // so clear the user — every auth() caller checks session?.user.
      if (!(await isActiveUser(token.userId))) {
        return { ...session, user: undefined } as unknown as Session;
      }

      session.user.id = token.userId as string;
      session.user.stravaId = token.stravaId as number;
      session.user.name = token.name as string;
      session.user.image = token.picture as string;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

