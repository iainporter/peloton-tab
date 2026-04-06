"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  rides,
  rideRiders,
  payments,
  groupMembers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { backfillGroupActivities } from "@/lib/backfill";

async function requireGroupMember(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!membership) throw new Error("Not a member of this group");
  return session.user.id;
}

export async function createRide(groupId: string, formData: FormData) {
  const userId = await requireGroupMember(groupId);

  const date = formData.get("date") as string;
  const title = (formData.get("title") as string)?.trim() || null;
  const participants = formData.getAll("participants") as string[];

  if (!date) throw new Error("Date is required");
  if (participants.length === 0) throw new Error("At least one participant is required");

  const [ride] = await db
    .insert(rides)
    .values({ groupId, date, title })
    .returning();

  await db.insert(rideRiders).values(
    participants.map((uid) => ({ rideId: ride.id, userId: uid })),
  );

  redirect(`/groups/${groupId}/rides/${ride.id}`);
}

export async function deleteRide(groupId: string, rideId: string) {
  await requireGroupMember(groupId);

  await db.delete(rides).where(eq(rides.id, rideId));

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function updateRideParticipants(
  groupId: string,
  rideId: string,
  formData: FormData,
) {
  await requireGroupMember(groupId);

  const participants = formData.getAll("participants") as string[];
  if (participants.length === 0) throw new Error("At least one participant is required");

  // Delete existing and re-insert
  await db.delete(rideRiders).where(eq(rideRiders.rideId, rideId));
  await db.insert(rideRiders).values(
    participants.map((uid) => ({ rideId, userId: uid })),
  );

  revalidatePath(`/groups/${groupId}/rides/${rideId}`);
  redirect(`/groups/${groupId}/rides/${rideId}`);
}

export async function addRiderToRide(
  groupId: string,
  rideId: string,
  userId: string,
) {
  await requireGroupMember(groupId);

  // Verify the user being added is a group member
  const [targetMembership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!targetMembership) throw new Error("User is not a member of this group");

  await db.insert(rideRiders).values({ rideId, userId }).onConflictDoNothing();

  revalidatePath(`/groups/${groupId}/rides/${rideId}`);
}

export async function addPayment(
  groupId: string,
  rideId: string,
  formData: FormData,
) {
  const userId = await requireGroupMember(groupId);

  const amountStr = formData.get("amount") as string;
  const note = (formData.get("note") as string)?.trim() || null;

  const pounds = parseFloat(amountStr);
  if (isNaN(pounds) || pounds <= 0) throw new Error("Invalid amount");

  const amount = Math.round(pounds * 100); // convert to pence

  await db.insert(payments).values({
    rideId,
    paidBy: userId,
    amount,
    note,
  });

  revalidatePath(`/groups/${groupId}/rides/${rideId}`);
  redirect(`/groups/${groupId}/rides/${rideId}`);
}

export async function editPayment(
  groupId: string,
  rideId: string,
  paymentId: string,
  formData: FormData,
) {
  await requireGroupMember(groupId);

  const amountStr = formData.get("amount") as string;
  const note = (formData.get("note") as string)?.trim() || null;

  const pounds = parseFloat(amountStr);
  if (isNaN(pounds) || pounds <= 0) throw new Error("Invalid amount");

  const amount = Math.round(pounds * 100);

  await db
    .update(payments)
    .set({ amount, note, updatedAt: new Date() })
    .where(eq(payments.id, paymentId));

  revalidatePath(`/groups/${groupId}/rides/${rideId}`);
}

export async function deletePayment(
  groupId: string,
  rideId: string,
  paymentId: string,
) {
  await requireGroupMember(groupId);

  await db.delete(payments).where(eq(payments.id, paymentId));

  revalidatePath(`/groups/${groupId}/rides/${rideId}`);
}

export async function syncStravaRides(groupId: string): Promise<{ success: boolean; message: string }> {
  await requireGroupMember(groupId);

  try {
    const result = await backfillGroupActivities(groupId);
    revalidatePath(`/groups/${groupId}`);
    const parts: string[] = [];
    parts.push(`Synced ${result.synced} new ride${result.synced === 1 ? "" : "s"} from Strava`);
    if (result.membersFailed > 0) {
      parts.push(`(${result.membersFailed} member${result.membersFailed === 1 ? "" : "s"} need to re-authenticate)`);
    }
    return { success: true, message: parts.join(" ") };
  } catch (error) {
    console.error("Strava sync failed:", error);
    return { success: false, message: "Failed to sync from Strava. Please try again." };
  }
}
