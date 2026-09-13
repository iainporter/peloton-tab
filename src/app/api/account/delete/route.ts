import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  users,
  groups,
  groupMembers,
  rideRiders,
  payments,
  stravaActivities,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getUnsettledTrips, hasTripHistory } from "@/lib/trip-data";

const DELETED_USER_NAME = "Deleted user";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Deleting would remove the user from trips still being tracked, changing
    // everyone else's balances. Checked before deauthorizing Strava so a
    // blocked deletion changes nothing.
    const unsettledTrips = await getUnsettledTrips(userId);

    if (unsettledTrips.length > 0) {
      const names = unsettledTrips
        .map((t) => `"${t.name}" (${t.groupName})`)
        .join(", ");
      return NextResponse.json(
        {
          error: `You're on ${
            unsettledTrips.length === 1 ? "a trip that hasn't" : "trips that haven't"
          } been settled: ${names}. Settle up, or ask a trip member to remove you, before deleting your account.`,
        },
        { status: 409 },
      );
    }

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

    // Users referenced by records that must outlive the account are anonymised
    // instead of deleted:
    // - settled trips keep their expenses and settlement payments so other
    //   members' records stay correct (trip tables restrict user deletion)
    // - groups keep their creator (groups.created_by blocks user deletion)
    const [tripHistory, createdGroups] = await Promise.all([
      hasTripHistory(userId),
      db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.createdBy, userId))
        .limit(1),
    ]);

    const keepUserRow = tripHistory || createdGroups.length > 0;
    const removeUser = keepUserRow
      ? db
          .update(users)
          .set({
            name: DELETED_USER_NAME,
            avatarUrl: null,
            stravaId: null, // frees the Strava account to sign up afresh
            stravaAccessToken: "",
            stravaRefreshToken: "",
            stravaTokenExpiresAt: new Date(0),
            deletedAt: new Date(),
          })
          .where(eq(users.id, userId))
      : db.delete(users).where(eq(users.id, userId));

    await db.batch([
      db.delete(stravaActivities).where(eq(stravaActivities.userId, userId)),
      db.delete(payments).where(eq(payments.paidBy, userId)),
      db.delete(rideRiders).where(eq(rideRiders.userId, userId)),
      db.delete(groupMembers).where(eq(groupMembers.userId, userId)),
      removeUser,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
