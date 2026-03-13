import { db } from "@/db";
import { payments, rideRiders, rides } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type MemberBalance = {
  userId: string;
  credit: number; // total pence paid
  debit: number; // total pence owed (sum of per-person shares)
  balance: number; // credit - debit (positive = others owe them)
};

/**
 * Calculate balances for all members in a group.
 * credit = sum of payments made by user in the group
 * debit = sum of (payment amount / rider count) for each ride user participated in
 * balance = credit - debit
 */
export async function getGroupBalances(
  groupId: string,
): Promise<MemberBalance[]> {
  // Get all rides in this group with their rider counts
  const groupRides = await db
    .select({
      rideId: rides.id,
      riderCount: sql<number>`(
        select count(*) from ride_riders where ride_id = ${rides.id}
      )::int`,
    })
    .from(rides)
    .where(eq(rides.groupId, groupId));

  if (groupRides.length === 0) return [];

  const rideIds = groupRides.map((r) => r.rideId);
  const riderCountMap = new Map(
    groupRides.map((r) => [r.rideId, r.riderCount]),
  );

  // Get all payments for these rides
  const allPayments = await db
    .select({
      rideId: payments.rideId,
      paidBy: payments.paidBy,
      amount: payments.amount,
    })
    .from(payments)
    .where(sql`${payments.rideId} in ${rideIds}`);

  // Get all ride participation
  const allParticipation = await db
    .select({
      rideId: rideRiders.rideId,
      userId: rideRiders.userId,
    })
    .from(rideRiders)
    .where(sql`${rideRiders.rideId} in ${rideIds}`);

  // Calculate credits per user (what they paid)
  const credits = new Map<string, number>();
  for (const p of allPayments) {
    credits.set(p.paidBy, (credits.get(p.paidBy) || 0) + p.amount);
  }

  // Calculate debits per user (their share of each ride's payments)
  const debits = new Map<string, number>();
  // First, get total payments per ride
  const ridePaymentTotals = new Map<string, number>();
  for (const p of allPayments) {
    ridePaymentTotals.set(
      p.rideId,
      (ridePaymentTotals.get(p.rideId) || 0) + p.amount,
    );
  }

  // For each ride participation, add the per-person share
  for (const rp of allParticipation) {
    const totalForRide = ridePaymentTotals.get(rp.rideId) || 0;
    const riderCount = riderCountMap.get(rp.rideId) || 1;
    const share = totalForRide / riderCount;
    debits.set(rp.userId, (debits.get(rp.userId) || 0) + share);
  }

  // Combine into balances for all users who appear in credits or debits
  const allUserIds = new Set([...credits.keys(), ...debits.keys()]);
  const balances: MemberBalance[] = [];

  for (const userId of allUserIds) {
    const credit = credits.get(userId) || 0;
    const debit = debits.get(userId) || 0;
    balances.push({
      userId,
      credit: Math.round(credit),
      debit: Math.round(debit),
      balance: Math.round(credit - debit),
    });
  }

  // Sort by balance descending (biggest creditor first)
  balances.sort((a, b) => b.balance - a.balance);

  return balances;
}

/**
 * Get a single user's balance in a group.
 */
export async function getUserGroupBalance(
  groupId: string,
  userId: string,
): Promise<number> {
  const balances = await getGroupBalances(groupId);
  const entry = balances.find((b) => b.userId === userId);
  return entry?.balance ?? 0;
}
