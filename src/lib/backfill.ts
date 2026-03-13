import { db } from "@/db";
import { stravaActivities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFreshAccessToken, fetchRecentActivities } from "./strava";
import { matchActivityToGroups } from "./activity-matching";

/**
 * Backfill: fetch a user's recent Strava activities (last 7 days)
 * and run matching against their groups.
 */
export async function backfillRecentActivities(userId: string) {
  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) return;

  const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const activities = await fetchRecentActivities(accessToken, sevenDaysAgo);

  for (const activity of activities) {
    // Only process rides
    if (activity.type !== "Ride") continue;

    // Skip if we already have this activity stored
    const [existing] = await db
      .select({ id: stravaActivities.id })
      .from(stravaActivities)
      .where(eq(stravaActivities.stravaActivityId, activity.id))
      .limit(1);

    if (existing) continue;

    const startLat = activity.start_latlng?.[0]?.toString() ?? null;
    const startLng = activity.start_latlng?.[1]?.toString() ?? null;
    const startDate = new Date(activity.start_date);

    // Store the activity
    await db.insert(stravaActivities).values({
      userId,
      stravaActivityId: activity.id,
      title: activity.name,
      startDate,
      elapsedTime: activity.elapsed_time,
      startLat,
      startLng,
    });

    // Run matching
    await matchActivityToGroups(userId, {
      stravaActivityId: activity.id,
      startDate,
      startLat,
      startLng,
    });
  }
}
