import { db } from "@/db";
import {
  stravaActivities,
  groupMembers,
  rides,
  rideRiders,
  users,
} from "@/db/schema";
import { eq, and, ne, gte, lte } from "drizzle-orm";

const MATCH_TIME_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const MATCH_DISTANCE_KM = 1; // 1 km

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if two activities match (started within 30min and within 1km).
 */
function activitiesMatch(
  a: { startDate: Date; startLat: string | null; startLng: string | null },
  b: { startDate: Date; startLat: string | null; startLng: string | null },
): boolean {
  // Time check
  const timeDiff = Math.abs(a.startDate.getTime() - b.startDate.getTime());
  if (timeDiff > MATCH_TIME_WINDOW_MS) return false;

  // Location check — if either has no location, match on time only
  if (!a.startLat || !a.startLng || !b.startLat || !b.startLng) return true;

  const dist = haversineKm(
    parseFloat(a.startLat),
    parseFloat(a.startLng),
    parseFloat(b.startLat),
    parseFloat(b.startLng),
  );

  return dist <= MATCH_DISTANCE_KM;
}

/**
 * For a newly stored activity, find matches in all groups the user belongs to.
 * Creates or updates auto-detected rides for each match.
 */
export async function matchActivityToGroups(
  userId: string,
  activity: {
    stravaActivityId: number;
    startDate: Date;
    startLat: string | null;
    startLng: string | null;
  },
) {
  // Find all groups the user belongs to
  const userGroups = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  for (const { groupId } of userGroups) {
    await matchActivityInGroup(userId, activity, groupId);
  }
}

async function matchActivityInGroup(
  userId: string,
  activity: {
    stravaActivityId: number;
    startDate: Date;
    startLat: string | null;
    startLng: string | null;
  },
  groupId: string,
) {
  // Get other group members
  const otherMembers = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, userId)),
    );

  if (otherMembers.length === 0) return;

  const otherUserIds = otherMembers.map((m) => m.userId);

  // Find their recent activities (within 24h window)
  const windowStart = new Date(activity.startDate.getTime() - MATCH_TIME_WINDOW_MS);
  const windowEnd = new Date(activity.startDate.getTime() + MATCH_TIME_WINDOW_MS);

  const candidateActivities = await db
    .select()
    .from(stravaActivities)
    .where(
      and(
        gte(stravaActivities.startDate, windowStart),
        lte(stravaActivities.startDate, windowEnd),
      ),
    );

  // Filter to only other group members' activities that match
  const matchedUserIds = new Set<string>();
  const matchedActivities = new Map<string, number>(); // userId -> stravaActivityId

  for (const candidate of candidateActivities) {
    if (!otherUserIds.includes(candidate.userId)) continue;

    if (
      activitiesMatch(activity, {
        startDate: candidate.startDate,
        startLat: candidate.startLat,
        startLng: candidate.startLng,
      })
    ) {
      matchedUserIds.add(candidate.userId);
      matchedActivities.set(candidate.userId, candidate.stravaActivityId);
    }
  }

  if (matchedUserIds.size === 0) return;

  // Check if any matched user is already in an auto-detected ride for this group on this date
  const rideDate = activity.startDate.toISOString().split("T")[0];
  const existingRides = await db
    .select({ id: rides.id })
    .from(rides)
    .innerJoin(rideRiders, eq(rideRiders.rideId, rides.id))
    .where(
      and(
        eq(rides.groupId, groupId),
        eq(rides.autoDetected, true),
        eq(rides.date, rideDate),
      ),
    );

  // Check if any existing ride already has one of our matched riders
  for (const existingRide of existingRides) {
    const existingRiders = await db
      .select({ userId: rideRiders.userId })
      .from(rideRiders)
      .where(eq(rideRiders.rideId, existingRide.id));

    const existingUserIds = new Set(existingRiders.map((r) => r.userId));

    // If any matched user is already on this ride, add the current user to it
    const hasOverlap = [...matchedUserIds].some((id) => existingUserIds.has(id));
    if (hasOverlap) {
      if (!existingUserIds.has(userId)) {
        await db.insert(rideRiders).values({
          rideId: existingRide.id,
          userId,
          stravaActivityId: activity.stravaActivityId,
        });
      }
      return; // Added to existing ride
    }
  }

  // No existing ride found — create a new auto-detected ride
  const [ride] = await db
    .insert(rides)
    .values({
      groupId,
      date: rideDate,
      title: null,
      autoDetected: true,
    })
    .returning();

  // Add all participants
  const participants = [
    { rideId: ride.id, userId, stravaActivityId: activity.stravaActivityId },
    ...[...matchedUserIds].map((uid) => ({
      rideId: ride.id,
      userId: uid,
      stravaActivityId: matchedActivities.get(uid) ?? null,
    })),
  ];

  await db.insert(rideRiders).values(participants);
}
