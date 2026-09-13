"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  expenseParticipants,
  expenses,
  groupMembers,
  tripMembers,
  tripRates,
  tripSettlements,
  trips,
  users,
  type RateSource,
} from "@/db/schema";
import { and, eq, inArray, notExists, or } from "drizzle-orm";
import { getTripLedger } from "@/lib/trip-data";
import { suggestSettlements } from "@/lib/trips";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  MAX_MINOR_UNITS,
  convertToBase,
  deriveRate,
  isCurrencyCode,
  parseRate,
  toMinor,
} from "@/lib/money";
import { getExchangeRate } from "@/lib/exchange-rates";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** An error whose message is safe to show to the user */
class ActionError extends Error {}

type FormResult = { error: string } | undefined;

/**
 * Run a form action, returning ActionError messages to the form (shown inline
 * by ActionForm) rather than throwing them — thrown errors show Next's error
 * page in production. Redirects and unexpected errors still throw.
 */
async function withFormErrors(run: () => Promise<void>): Promise<FormResult> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }
  return undefined;
}

async function requireGroupMember(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new ActionError("Not authenticated");

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

  if (!membership) throw new ActionError("Not a member of this group");
  return session.user.id;
}

async function getGroupMemberIds(groupId: string) {
  const rows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return new Set(rows.map((r) => r.userId));
}

/**
 * Require the current user to be a member of the trip, and the trip to belong to the group.
 */
async function requireTripMember(groupId: string, tripId: string) {
  const userId = await requireGroupMember(groupId);

  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.groupId, groupId)))
    .limit(1);

  if (!trip) throw new ActionError("Trip not found");

  const memberRows = await db
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(eq(tripMembers.tripId, tripId));
  const memberIds = new Set(memberRows.map((r) => r.userId));

  if (!memberIds.has(userId)) throw new ActionError("Not a member of this trip");

  return { userId, trip, memberIds };
}

function requireOpen(trip: { status: string }) {
  if (trip.status === "settling") {
    throw new ActionError("This trip is being settled. Reopen it to make changes.");
  }
  if (trip.status === "settled") {
    throw new ActionError("This trip has been settled. Reopen it to make changes.");
  }
}

function revalidateTrip(groupId: string, tripId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`, "layout");
}

async function requireSettlementParty(
  tripId: string,
  settlementId: string,
  userId: string,
) {
  const [settlement] = await db
    .select()
    .from(tripSettlements)
    .where(
      and(
        eq(tripSettlements.id, settlementId),
        eq(tripSettlements.tripId, tripId),
      ),
    )
    .limit(1);

  if (!settlement) throw new ActionError("Payment not found");
  if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
    throw new ActionError("Only the payer or recipient can update this payment");
  }

  return settlement;
}

async function getTripRateMap(tripId: string) {
  const rows = await db
    .select({ currency: tripRates.currency, rate: tripRates.rate })
    .from(tripRates)
    .where(eq(tripRates.tripId, tripId));
  return new Map(rows.map((r) => [r.currency, r.rate]));
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value === "") return null;
  if (!ISO_DATE.test(value)) throw new ActionError("Invalid date");
  return value;
}

function parseTripDetails(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new ActionError("Trip name is required");

  const startDate = parseOptionalDate(formData.get("startDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  if (startDate && endDate && endDate < startDate) {
    throw new ActionError("End date must be on or after the start date");
  }

  return { name, startDate, endDate };
}

/**
 * Work out the base currency amount for an expense from the chosen conversion method:
 * - "trip": the trip's rate for the currency
 * - "rate": a rate entered by the user (or fetched, flagged by `rateFetched`)
 * - "charged": the base currency amount actually charged, with the rate derived from it
 */
function parseConversion(
  formData: FormData,
  amount: number,
  currency: string,
  baseCurrency: string,
  tripRateMap: Map<string, string>,
): { rate: string; rateSource: RateSource; baseAmount: number } {
  if (currency === baseCurrency) {
    return { rate: "1", rateSource: "base", baseAmount: amount };
  }

  let result: { rate: string; rateSource: RateSource; baseAmount: number };

  switch (formData.get("conversion")) {
    case "trip": {
      const rate = tripRateMap.get(currency);
      if (!rate) throw new ActionError(`No trip rate set for ${currency}`);
      result = {
        rate,
        rateSource: "trip",
        baseAmount: convertToBase(amount, currency, rate, baseCurrency),
      };
      break;
    }
    case "rate": {
      const rate = parseRate((formData.get("rate") as string) ?? "");
      if (!rate) throw new ActionError("Invalid exchange rate");
      result = {
        rate,
        rateSource: formData.get("rateFetched") === "true" ? "live" : "manual",
        baseAmount: convertToBase(amount, currency, rate, baseCurrency),
      };
      break;
    }
    case "charged": {
      const baseAmount = toMinor(
        (formData.get("chargedAmount") as string) ?? "",
        baseCurrency,
      );
      if (!baseAmount) throw new ActionError(`Invalid ${baseCurrency} amount`);
      const rate = deriveRate(amount, currency, baseAmount, baseCurrency);
      if (!rate) throw new ActionError("Those amounts don't give a valid exchange rate");
      result = { rate, rateSource: "manual", baseAmount };
      break;
    }
    default:
      throw new ActionError(`Choose how to convert ${currency} to ${baseCurrency}`);
  }

  if (result.baseAmount <= 0 || result.baseAmount > MAX_MINOR_UNITS) {
    throw new ActionError(`The converted ${baseCurrency} amount is invalid`);
  }

  return result;
}

function parseExpense(
  formData: FormData,
  baseCurrency: string,
  memberIds: Set<string>,
  tripRateMap: Map<string, string>,
) {
  const description = (formData.get("description") as string)?.trim();
  if (!description) throw new ActionError("Description is required");

  const date = formData.get("date") as string;
  if (!date || !ISO_DATE.test(date)) throw new ActionError("Date is required");

  const currency = formData.get("currency") as string;
  if (!isCurrencyCode(currency)) throw new ActionError("Unsupported currency");

  const amount = toMinor((formData.get("amount") as string) ?? "", currency);
  if (!amount) throw new ActionError("Invalid amount");

  const paidBy = formData.get("paidBy") as string;
  if (!memberIds.has(paidBy)) throw new ActionError("Payer must be a trip member");

  const participants = [...new Set(formData.getAll("participants") as string[])];
  if (participants.length === 0) {
    throw new ActionError("At least one participant is required");
  }
  if (participants.some((id) => !memberIds.has(id))) {
    throw new ActionError("Participants must be trip members");
  }

  return {
    description,
    date,
    currency,
    amount,
    paidBy,
    participants,
    ...parseConversion(formData, amount, currency, baseCurrency, tripRateMap),
  };
}

export async function createTrip(groupId: string, formData: FormData) {
  return withFormErrors(() => createTripOrThrow(groupId, formData));
}

async function createTripOrThrow(groupId: string, formData: FormData) {
  const userId = await requireGroupMember(groupId);
  const details = parseTripDetails(formData);

  const baseCurrency = formData.get("baseCurrency") as string;
  if (!isCurrencyCode(baseCurrency)) throw new ActionError("Unsupported currency");

  // The creator is always on the trip
  const members = new Set([...(formData.getAll("members") as string[]), userId]);
  const groupMemberIds = await getGroupMemberIds(groupId);
  if ([...members].some((id) => !groupMemberIds.has(id))) {
    throw new ActionError("Trip members must be group members");
  }

  const tripId = crypto.randomUUID();

  await db.batch([
    db.insert(trips).values({
      id: tripId,
      groupId,
      ...details,
      baseCurrency,
      createdBy: userId,
    }),
    db
      .insert(tripMembers)
      .values([...members].map((uid) => ({ tripId, userId: uid }))),
  ]);

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}/trips/${tripId}`);
}

export async function updateTrip(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  return withFormErrors(() => updateTripOrThrow(groupId, tripId, formData));
}

async function updateTripOrThrow(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  await requireTripMember(groupId, tripId);
  const details = parseTripDetails(formData);

  await db.update(trips).set(details).where(eq(trips.id, tripId));

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  redirect(`/groups/${groupId}/trips/${tripId}`);
}

export async function deleteTrip(groupId: string, tripId: string) {
  await requireTripMember(groupId, tripId);

  await db.delete(trips).where(eq(trips.id, tripId));

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

export async function addTripMember(
  groupId: string,
  tripId: string,
  userId: string,
) {
  const { trip } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const groupMemberIds = await getGroupMemberIds(groupId);
  if (!groupMemberIds.has(userId)) {
    throw new ActionError("User is not a member of this group");
  }

  await db
    .insert(tripMembers)
    .values({ tripId, userId })
    .onConflictDoNothing();

  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}/settings`);
}

export async function removeTripMember(
  groupId: string,
  tripId: string,
  userId: string,
) {
  const { trip, memberIds } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  if (memberIds.size <= 1) {
    throw new ActionError("A trip needs at least one member");
  }

  // Prevent removing a member who paid for or shared in any expense
  const [involvement] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .leftJoin(
      expenseParticipants,
      and(
        eq(expenseParticipants.expenseId, expenses.id),
        eq(expenseParticipants.userId, userId),
      ),
    )
    .where(
      and(
        eq(expenses.tripId, tripId),
        or(eq(expenses.paidBy, userId), eq(expenseParticipants.userId, userId)),
      ),
    )
    .limit(1);

  if (involvement) {
    throw new ActionError(
      "Cannot remove a member who is on an expense. Remove them from those expenses first.",
    );
  }

  await db
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));

  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}/settings`);
}

export async function setTripRate(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  return withFormErrors(() => setTripRateOrThrow(groupId, tripId, formData));
}

async function setTripRateOrThrow(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  const { trip } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const currency = formData.get("currency") as string;
  if (!isCurrencyCode(currency) || currency === trip.baseCurrency) {
    throw new ActionError("Choose a currency other than the trip's base currency");
  }

  const rate = parseRate((formData.get("rate") as string) ?? "");
  if (!rate) throw new ActionError("Invalid exchange rate");

  // Recalculate every expense that uses the trip rate for this currency
  const affected = await db
    .select({ id: expenses.id, amount: expenses.amount })
    .from(expenses)
    .where(
      and(
        eq(expenses.tripId, tripId),
        eq(expenses.currency, currency),
        eq(expenses.rateSource, "trip"),
      ),
    );

  const recalculated = affected.map((e) => ({
    id: e.id,
    baseAmount: convertToBase(e.amount, currency, rate, trip.baseCurrency),
  }));

  if (recalculated.some((e) => e.baseAmount <= 0 || e.baseAmount > MAX_MINOR_UNITS)) {
    throw new ActionError("This rate converts some expenses to an invalid amount");
  }

  const now = new Date();

  await db.batch([
    db
      .insert(tripRates)
      .values({ tripId, currency, rate })
      .onConflictDoUpdate({
        target: [tripRates.tripId, tripRates.currency],
        set: { rate, updatedAt: now },
      }),
    ...recalculated.map((e) =>
      db
        .update(expenses)
        .set({ rate, baseAmount: e.baseAmount, updatedAt: now })
        .where(eq(expenses.id, e.id)),
    ),
  ] as const);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}/settings`);
}

export async function deleteTripRate(
  groupId: string,
  tripId: string,
  currency: string,
) {
  const { trip } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const [inUse] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(
      and(
        eq(expenses.tripId, tripId),
        eq(expenses.currency, currency),
        eq(expenses.rateSource, "trip"),
      ),
    )
    .limit(1);

  if (inUse) {
    throw new ActionError(`Expenses use the ${currency} trip rate, so it can't be removed`);
  }

  await db
    .delete(tripRates)
    .where(and(eq(tripRates.tripId, tripId), eq(tripRates.currency, currency)));

  revalidatePath(`/groups/${groupId}/trips/${tripId}/settings`);
}

export async function fetchExchangeRate(
  groupId: string,
  from: string,
  to: string,
  date?: string,
): Promise<{ rate: string; date: string } | { error: string }> {
  await requireGroupMember(groupId);

  if (!isCurrencyCode(from) || !isCurrencyCode(to) || from === to) {
    return { error: "Unsupported currency" };
  }

  // There are no rates for future dates — use the latest for today onwards
  const today = new Date().toISOString().split("T")[0];
  const day = date && ISO_DATE.test(date) && date < today ? date : null;

  try {
    return await getExchangeRate(from, to, day);
  } catch (error) {
    console.error("Exchange rate fetch failed:", error);
    return { error: "Couldn't fetch a rate. Enter one manually." };
  }
}

export async function addExpense(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  return withFormErrors(() => addExpenseOrThrow(groupId, tripId, formData));
}

async function addExpenseOrThrow(
  groupId: string,
  tripId: string,
  formData: FormData,
) {
  const { userId, trip, memberIds } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const { participants, ...expense } = parseExpense(
    formData,
    trip.baseCurrency,
    memberIds,
    await getTripRateMap(tripId),
  );
  const expenseId = crypto.randomUUID();

  await db.batch([
    db.insert(expenses).values({
      id: expenseId,
      tripId,
      ...expense,
      createdBy: userId,
    }),
    db
      .insert(expenseParticipants)
      .values(participants.map((uid) => ({ expenseId, userId: uid }))),
  ]);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  redirect(`/groups/${groupId}/trips/${tripId}`);
}

export async function editExpense(
  groupId: string,
  tripId: string,
  expenseId: string,
  formData: FormData,
) {
  return withFormErrors(() =>
    editExpenseOrThrow(groupId, tripId, expenseId, formData),
  );
}

async function editExpenseOrThrow(
  groupId: string,
  tripId: string,
  expenseId: string,
  formData: FormData,
) {
  const { trip, memberIds } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const [existing] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)))
    .limit(1);

  if (!existing) throw new ActionError("Expense not found");

  const { participants, ...expense } = parseExpense(
    formData,
    trip.baseCurrency,
    memberIds,
    await getTripRateMap(tripId),
  );

  await db.batch([
    db
      .update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(expenses.id, expenseId)),
    db
      .delete(expenseParticipants)
      .where(eq(expenseParticipants.expenseId, expenseId)),
    db
      .insert(expenseParticipants)
      .values(participants.map((uid) => ({ expenseId, userId: uid }))),
  ]);

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  redirect(`/groups/${groupId}/trips/${tripId}`);
}

export async function deleteExpense(
  groupId: string,
  tripId: string,
  expenseId: string,
) {
  const { trip } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)));

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/trips/${tripId}`);
  redirect(`/groups/${groupId}/trips/${tripId}`);
}

/**
 * Lock the trip and create suggested payments that bring every balance to zero.
 * If everyone is already even, the trip is settled straight away.
 */
export async function settleTrip(groupId: string, tripId: string) {
  const { trip } = await requireTripMember(groupId, tripId);
  requireOpen(trip);

  const { balances } = await getTripLedger(tripId);
  const transfers = suggestSettlements(balances);

  if (transfers.length === 0) {
    await db
      .update(trips)
      .set({ status: "settled" })
      .where(and(eq(trips.id, tripId), eq(trips.status, "open")));
  } else {
    await db.batch([
      db
        .update(trips)
        .set({ status: "settling" })
        .where(and(eq(trips.id, tripId), eq(trips.status, "open"))),
      // Clear suggestions from a concurrent settle so payments aren't duplicated
      db
        .delete(tripSettlements)
        .where(
          and(
            eq(tripSettlements.tripId, tripId),
            eq(tripSettlements.status, "suggested"),
          ),
        ),
      db
        .insert(tripSettlements)
        .values(transfers.map((t) => ({ tripId, ...t }))),
    ]);
  }

  revalidateTrip(groupId, tripId);
}

export async function markSettlementPaid(
  groupId: string,
  tripId: string,
  settlementId: string,
) {
  const { userId, trip } = await requireTripMember(groupId, tripId);
  if (trip.status !== "settling") throw new ActionError("This trip isn't being settled");

  const settlement = await requireSettlementParty(tripId, settlementId, userId);
  if (settlement.status === "paid") return;

  await db.batch([
    db
      .update(tripSettlements)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(tripSettlements.id, settlementId)),
    // Once every payment has been made, the trip is settled
    db
      .update(trips)
      .set({ status: "settled" })
      .where(
        and(
          eq(trips.id, tripId),
          eq(trips.status, "settling"),
          notExists(
            db
              .select({ id: tripSettlements.id })
              .from(tripSettlements)
              .where(
                and(
                  eq(tripSettlements.tripId, tripId),
                  eq(tripSettlements.status, "suggested"),
                ),
              ),
          ),
        ),
      ),
  ]);

  revalidateTrip(groupId, tripId);
}

/**
 * Undo a payment marked by mistake. While settling it goes back to a suggestion;
 * on a reopened trip the leftover payment record is removed.
 */
export async function undoSettlementPayment(
  groupId: string,
  tripId: string,
  settlementId: string,
) {
  const { userId, trip } = await requireTripMember(groupId, tripId);
  if (trip.status === "settled") {
    throw new ActionError("This trip has been settled. Reopen it to undo a payment.");
  }

  const settlement = await requireSettlementParty(tripId, settlementId, userId);
  if (settlement.status !== "paid") return;

  if (trip.status === "settling") {
    await db
      .update(tripSettlements)
      .set({ status: "suggested", paidAt: null })
      .where(eq(tripSettlements.id, settlementId));
  } else {
    await db
      .delete(tripSettlements)
      .where(eq(tripSettlements.id, settlementId));
  }

  revalidateTrip(groupId, tripId);
}

/**
 * Reopen a settling or settled trip. Unpaid suggestions are removed; paid
 * payments are kept and still count towards balances.
 */
export async function reopenTrip(
  groupId: string,
  tripId: string,
): Promise<{ error: string } | undefined> {
  const { trip, memberIds } = await requireTripMember(groupId, tripId);
  if (trip.status === "open") return;

  // Members may have left the group once the trip was settled
  const groupMemberIds = await getGroupMemberIds(groupId);
  const departedIds = [...memberIds].filter((id) => !groupMemberIds.has(id));

  if (departedIds.length > 0) {
    const departed = await db
      .select({ name: users.name })
      .from(users)
      .where(inArray(users.id, departedIds));
    return {
      error: `${departed.map((u) => u.name).join(", ")} left the group after the trip was settled, so it can't be reopened.`,
    };
  }

  await db.batch([
    db
      .delete(tripSettlements)
      .where(
        and(
          eq(tripSettlements.tripId, tripId),
          eq(tripSettlements.status, "suggested"),
        ),
      ),
    db.update(trips).set({ status: "open" }).where(eq(trips.id, tripId)),
  ]);

  revalidateTrip(groupId, tripId);
}
