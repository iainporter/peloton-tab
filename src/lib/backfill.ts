import { db } from "@/db";
import { stravaActivities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFreshAccessToken, fetchRecentActivities } from "./strava";
import { matchActivityToGroups } from "./activity-matching";

/**
 * Backfill: fetch a user's recent Strava activities (last 7 days)
 * and run matching against their groups.
 * Returns the count of newly synced activities.
 */
export async function backfillRecentActivities(userId: string): Promise<{ synced: number }> {
  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) {
    throw new Error("Could not get Strava access token — try signing out and back in");
  }

  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const activities = await fetchRecentActivities(accessToken, sevenDaysAgo);

  let synced = 0;

  for (const activity of activities) {
    // Only process rides
    if (activity.type !== "Ride") continue;

    const startLat = activity.start_latlng?.[0]?.toString() ?? null;
    const startLng = activity.start_latlng?.[1]?.toString() ?? null;
    const startDate = new Date(activity.start_date);

    // Store the activity if new
    const [existing] = await db
      .select({ id: stravaActivities.id })
      .from(stravaActivities)
      .where(eq(stravaActivities.stravaActivityId, activity.id))
      .limit(1);

    if (!existing) {
      await db.insert(stravaActivities).values({
        userId,
        stravaActivityId: activity.id,
        title: activity.name,
        startDate,
        elapsedTime: activity.elapsed_time,
        startLat,
        startLng,
      });
      synced++;
    }

    // Always re-run matching (other members' activities may have arrived since last sync)
    await matchActivityToGroups(userId, {
      stravaActivityId: activity.id,
      startDate,
      startLat,
      startLng,
    });
  }

  return { synced };
}
