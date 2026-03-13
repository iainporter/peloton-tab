import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get a fresh Strava access token for a user, refreshing if expired.
 */
export async function getFreshAccessToken(userId: string): Promise<string | null> {
  const [user] = await db
    .select({
      stravaAccessToken: users.stravaAccessToken,
      stravaRefreshToken: users.stravaRefreshToken,
      stravaTokenExpiresAt: users.stravaTokenExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  // Token still valid (with 60s buffer)
  if (user.stravaTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return user.stravaAccessToken;
  }

  // Refresh the token
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: user.stravaRefreshToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Failed to refresh Strava token for user", userId, data);
    return null;
  }

  await db
    .update(users)
    .set({
      stravaAccessToken: data.access_token,
      stravaRefreshToken: data.refresh_token ?? user.stravaRefreshToken,
      stravaTokenExpiresAt: new Date(data.expires_at * 1000),
    })
    .where(eq(users.id, userId));

  return data.access_token;
}

export interface StravaActivity {
  id: number;
  name: string;
  start_date: string; // ISO 8601
  elapsed_time: number; // seconds
  start_latlng: [number, number] | null;
  type: string;
}

/**
 * Fetch a single activity from Strava by ID.
 */
export async function fetchStravaActivity(
  accessToken: string,
  activityId: number,
): Promise<StravaActivity | null> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    console.error("Failed to fetch Strava activity", activityId, response.status);
    return null;
  }

  return response.json();
}

/**
 * Fetch recent activities for a user from Strava.
 */
export async function fetchRecentActivities(
  accessToken: string,
  afterEpoch: number,
): Promise<StravaActivity[]> {
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    console.error("Failed to fetch recent Strava activities", response.status);
    return [];
  }

  return response.json();
}
