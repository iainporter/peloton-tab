import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, stravaActivities } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFreshAccessToken, fetchStravaActivity } from "@/lib/strava";
import { matchActivityToGroups } from "@/lib/activity-matching";

/**
 * GET — Strava webhook verification challenge.
 * Strava sends: ?hub.mode=subscribe&hub.challenge=xxx&hub.verify_token=yyy
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = searchParams.get("hub.verify_token");

  if (
    mode === "subscribe" &&
    verifyToken === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST — Strava webhook event callback.
 * Receives activity create/update/delete events.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { object_type, aspect_type, object_id, owner_id } = body;

  // We only care about activity create events
  if (object_type !== "activity" || aspect_type !== "create") {
    return NextResponse.json({ ok: true });
  }

  // Find the user by Strava athlete ID
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stravaId, owner_id))
    .limit(1);

  if (!user) {
    // Unknown user — ignore
    return NextResponse.json({ ok: true });
  }

  // Get a fresh access token
  const accessToken = await getFreshAccessToken(user.id);
  if (!accessToken) {
    console.error("Could not get access token for user", user.id);
    return NextResponse.json({ ok: true });
  }

  // Fetch the full activity from Strava
  const activity = await fetchStravaActivity(accessToken, object_id);
  if (!activity) {
    return NextResponse.json({ ok: true });
  }

  // Only process ride-type activities
  if (activity.type !== "Ride") {
    return NextResponse.json({ ok: true });
  }

  // Check if we already have this activity
  const [existing] = await db
    .select({ id: stravaActivities.id })
    .from(stravaActivities)
    .where(eq(stravaActivities.stravaActivityId, object_id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const startLat = activity.start_latlng?.[0]?.toString() ?? null;
  const startLng = activity.start_latlng?.[1]?.toString() ?? null;
  const startDate = new Date(activity.start_date);

  // Store the activity
  await db.insert(stravaActivities).values({
    userId: user.id,
    stravaActivityId: activity.id,
    title: activity.name,
    startDate,
    elapsedTime: activity.elapsed_time,
    startLat,
    startLng,
  });

  // Run the matching algorithm
  await matchActivityToGroups(user.id, {
    stravaActivityId: activity.id,
    startDate,
    startLat,
    startLng,
  });

  return NextResponse.json({ ok: true });
}
