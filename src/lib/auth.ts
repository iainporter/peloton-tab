import NextAuth from "next-auth";
import Strava from "./strava-provider";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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

      // Check if access token needs refreshing
      if (token.expiresAt && Date.now() >= (token.expiresAt as number) * 1000) {
        return await refreshStravaToken(token);
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.stravaId = token.stravaId as number;
      session.user.name = token.name as string;
      session.user.image = token.picture as string;
      if (token.error) {
        session.error = token.error as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

async function refreshStravaToken(token: any) {
  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw data;

    // Update tokens in database
    await db
      .update(users)
      .set({
        stravaAccessToken: data.access_token,
        stravaRefreshToken: data.refresh_token ?? token.refreshToken,
        stravaTokenExpiresAt: new Date(data.expires_at * 1000),
      })
      .where(eq(users.stravaId, token.stravaId as number));

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    console.error("Error refreshing Strava token for stravaId:", token.stravaId, error);
    // Clear stored tokens so stale refresh tokens don't keep retrying
    if (token.stravaId) {
      await db
        .update(users)
        .set({
          stravaAccessToken: "",
          stravaRefreshToken: "",
          stravaTokenExpiresAt: new Date(0),
        })
        .where(eq(users.stravaId, token.stravaId as number))
        .catch(() => {}); // best-effort cleanup
    }
    return { ...token, error: "RefreshTokenError" };
  }
}
