import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  groupMembers,
  rideRiders,
  payments,
  stravaActivities,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Deauthorize on Strava's side
    const [user] = await db
      .select({ accessToken: users.stravaAccessToken })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.accessToken) {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: user.accessToken }),
      }).catch(() => {
        // Best effort — continue with deletion even if Strava call fails
      });
    }

    // Delete all user data (cascade handles group_members, ride_riders, payments, strava_activities)
    await db.delete(stravaActivities).where(eq(stravaActivities.userId, userId));
    await db.delete(payments).where(eq(payments.paidBy, userId));
    await db.delete(rideRiders).where(eq(rideRiders.userId, userId));
    await db.delete(groupMembers).where(eq(groupMembers.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
