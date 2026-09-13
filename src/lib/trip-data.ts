import { db } from "@/db";
import {
  expenseParticipants,
  expenses,
  groupMembers,
  groups,
  tripMembers,
  tripRates,
  tripSettlements,
  trips,
  users,
} from "@/db/schema";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
import { computeTripBalances } from "@/lib/trips";
import { parseRate } from "@/lib/money";

/**
 * Load a trip, checking it belongs to the group and the user is a group member.
 * Returns null if either check fails.
 */
export async function getTripForGroupMember(
  groupId: string,
  tripId: string,
  userId: string,
) {
  const [row] = await db
    .select({ trip: trips })
    .from(trips)
    .innerJoin(
      groupMembers,
      and(
        eq(groupMembers.groupId, trips.groupId),
        eq(groupMembers.userId, userId),
      ),
    )
    .where(and(eq(trips.id, tripId), eq(trips.groupId, groupId)))
    .limit(1);

  return row?.trip ?? null;
}

/**
 * Trips the user is on that haven't been settled, optionally within one group.
 * While any exist the user can't leave the group or delete their account, as
 * that would remove their expenses and settlement payments from everyone's balances.
 */
export async function getUnsettledTrips(userId: string, groupId?: string) {
  return db
    .select({ id: trips.id, name: trips.name, groupName: groups.name })
    .from(tripMembers)
    .innerJoin(trips, eq(trips.id, tripMembers.tripId))
    .innerJoin(groups, eq(groups.id, trips.groupId))
    .where(
      and(
        eq(tripMembers.userId, userId),
        ne(trips.status, "settled"),
        groupId ? eq(trips.groupId, groupId) : undefined,
      ),
    );
}

/**
 * Whether the user appears anywhere in trip records (member, payer, participant
 * or settlement party). Such users are anonymised rather than deleted.
 */
export async function hasTripHistory(userId: string) {
  const results = await Promise.all([
    db
      .select({ tripId: tripMembers.tripId })
      .from(tripMembers)
      .where(eq(tripMembers.userId, userId))
      .limit(1),
    db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.paidBy, userId))
      .limit(1),
    db
      .select({ expenseId: expenseParticipants.expenseId })
      .from(expenseParticipants)
      .where(eq(expenseParticipants.userId, userId))
      .limit(1),
    db
      .select({ id: tripSettlements.id })
      .from(tripSettlements)
      .where(
        or(
          eq(tripSettlements.fromUserId, userId),
          eq(tripSettlements.toUserId, userId),
        ),
      )
      .limit(1),
  ]);

  return results.some((rows) => rows.length > 0);
}

function groupParticipants(rows: { expenseId: string; userId: string }[]) {
  const byExpense = new Map<string, string[]>();
  for (const row of rows) {
    const list = byExpense.get(row.expenseId) ?? [];
    list.push(row.userId);
    byExpense.set(row.expenseId, list);
  }
  return byExpense;
}

/**
 * Load a trip's members, expenses (newest first), exchange rates, settlement
 * payments and balances (including paid settlements).
 * Rates are normalised ("0.86000000" → "0.86").
 */
export async function getTripLedger(tripId: string) {
  const [members, expenseRows, participantRows, rateRows, settlementRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(tripMembers)
      .innerJoin(users, eq(users.id, tripMembers.userId))
      .where(eq(tripMembers.tripId, tripId))
      .orderBy(users.name),
    db
      .select({
        id: expenses.id,
        description: expenses.description,
        date: expenses.date,
        paidBy: expenses.paidBy,
        payerName: users.name,
        amount: expenses.amount,
        currency: expenses.currency,
        rate: expenses.rate,
        rateSource: expenses.rateSource,
        baseAmount: expenses.baseAmount,
      })
      .from(expenses)
      .innerJoin(users, eq(users.id, expenses.paidBy))
      .where(eq(expenses.tripId, tripId))
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db
      .select({
        expenseId: expenseParticipants.expenseId,
        userId: expenseParticipants.userId,
      })
      .from(expenseParticipants)
      .innerJoin(expenses, eq(expenses.id, expenseParticipants.expenseId))
      .where(eq(expenses.tripId, tripId)),
    db
      .select({ currency: tripRates.currency, rate: tripRates.rate })
      .from(tripRates)
      .where(eq(tripRates.tripId, tripId))
      .orderBy(tripRates.currency),
    db
      .select({
        id: tripSettlements.id,
        fromUserId: tripSettlements.fromUserId,
        toUserId: tripSettlements.toUserId,
        amount: tripSettlements.amount,
        status: tripSettlements.status,
        paidAt: tripSettlements.paidAt,
      })
      .from(tripSettlements)
      .where(eq(tripSettlements.tripId, tripId))
      .orderBy(tripSettlements.createdAt),
  ]);

  const participantsByExpense = groupParticipants(participantRows);
  const tripExpenses = expenseRows.map((expense) => ({
    ...expense,
    rate: parseRate(expense.rate) ?? expense.rate,
    participantIds: participantsByExpense.get(expense.id) ?? [],
  }));

  return {
    members,
    expenses: tripExpenses,
    rates: rateRows.map((r) => ({
      currency: r.currency,
      rate: parseRate(r.rate) ?? r.rate,
    })),
    settlements: settlementRows,
    balances: computeTripBalances(
      members.map((m) => m.id),
      tripExpenses,
      settlementRows.filter((s) => s.status === "paid"),
    ),
    totalMinor: tripExpenses.reduce((sum, e) => sum + e.baseAmount, 0),
  };
}

/**
 * Summaries of every trip in a group, including the given user's balance on each.
 */
export async function getGroupTripSummaries(groupId: string, userId: string) {
  const groupTrips = await db
    .select()
    .from(trips)
    .where(eq(trips.groupId, groupId))
    .orderBy(desc(trips.createdAt));

  if (groupTrips.length === 0) return [];

  const tripIds = groupTrips.map((t) => t.id);

  const [memberRows, expenseRows, participantRows, paidSettlementRows] = await Promise.all([
    db
      .select({ tripId: tripMembers.tripId, userId: tripMembers.userId })
      .from(tripMembers)
      .where(inArray(tripMembers.tripId, tripIds)),
    db
      .select({
        id: expenses.id,
        tripId: expenses.tripId,
        paidBy: expenses.paidBy,
        baseAmount: expenses.baseAmount,
      })
      .from(expenses)
      .where(inArray(expenses.tripId, tripIds)),
    db
      .select({
        expenseId: expenseParticipants.expenseId,
        userId: expenseParticipants.userId,
      })
      .from(expenseParticipants)
      .innerJoin(expenses, eq(expenses.id, expenseParticipants.expenseId))
      .where(inArray(expenses.tripId, tripIds)),
    db
      .select({
        tripId: tripSettlements.tripId,
        fromUserId: tripSettlements.fromUserId,
        toUserId: tripSettlements.toUserId,
        amount: tripSettlements.amount,
      })
      .from(tripSettlements)
      .where(
        and(
          inArray(tripSettlements.tripId, tripIds),
          eq(tripSettlements.status, "paid"),
        ),
      ),
  ]);

  const participantsByExpense = groupParticipants(participantRows);

  return groupTrips.map((trip) => {
    const memberIds = memberRows
      .filter((m) => m.tripId === trip.id)
      .map((m) => m.userId);
    const tripExpenses = expenseRows
      .filter((e) => e.tripId === trip.id)
      .map((e) => ({
        ...e,
        participantIds: participantsByExpense.get(e.id) ?? [],
      }));
    const balances = computeTripBalances(
      memberIds,
      tripExpenses,
      paidSettlementRows.filter((s) => s.tripId === trip.id),
    );

    return {
      ...trip,
      memberCount: memberIds.length,
      isMember: memberIds.includes(userId),
      totalMinor: tripExpenses.reduce((sum, e) => sum + e.baseAmount, 0),
      userBalance: balances.find((b) => b.userId === userId)?.balance ?? 0,
    };
  });
}
