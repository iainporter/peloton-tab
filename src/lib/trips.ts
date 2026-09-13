export type TripExpenseSplit = {
  id: string;
  paidBy: string;
  baseAmount: number; // minor units of the trip base currency
  participantIds: string[];
};

export type TripTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number; // minor units of the trip base currency
};

export type TripMemberBalance = {
  userId: string;
  paid: number; // total minor units paid
  share: number; // total minor units of expenses they took part in
  sent: number; // settlement payments made to other members
  received: number; // settlement payments received from other members
  balance: number; // paid - share + sent - received (positive = others owe them)
};

/**
 * Format optional trip dates for display ("12 Jun – 19 Jun 2027").
 */
export function formatTripDates(
  startDate: string | null,
  endDate: string | null,
): string | null {
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-GB", options);
  const full = { day: "numeric", month: "short", year: "numeric" } as const;

  if (startDate && endDate) {
    if (startDate === endDate) return format(startDate, full);
    return `${format(startDate, { day: "numeric", month: "short" })} – ${format(endDate, full)}`;
  }
  if (startDate) return `From ${format(startDate, full)}`;
  if (endDate) return `Until ${format(endDate, full)}`;
  return null;
}

/**
 * Split an amount (minor units) equally across participants.
 * Leftover units go one each to participants in sorted id order, starting at an
 * offset derived from `seed` (the expense id) so the same person doesn't always
 * pick up the extra penny. Shares always sum exactly to `amount`.
 */
export function splitEvenly(
  amount: number,
  participantIds: string[],
  seed = "",
): Map<string, number> {
  const ids = [...new Set(participantIds)].sort();
  const shares = new Map<string, number>();
  if (ids.length === 0) return shares;

  const base = Math.floor(amount / ids.length);
  const remainder = amount - base * ids.length;

  let offset = 0;
  for (const char of seed) offset = (offset + char.charCodeAt(0)) % ids.length;

  ids.forEach((id, i) => {
    const position = (i - offset + ids.length) % ids.length;
    shares.set(id, base + (position < remainder ? 1 : 0));
  });

  return shares;
}

/**
 * Calculate balances for every trip member (and anyone else appearing on an expense).
 * Pass only settlement payments that have been marked as paid.
 * Because splits are exact, balances always sum to zero.
 * Sorted by balance descending (biggest creditor first).
 */
export function computeTripBalances(
  memberIds: string[],
  expenses: TripExpenseSplit[],
  paidSettlements: TripTransfer[] = [],
): TripMemberBalance[] {
  const balances = new Map<string, TripMemberBalance>();
  const entry = (userId: string) => {
    let b = balances.get(userId);
    if (!b) {
      b = { userId, paid: 0, share: 0, sent: 0, received: 0, balance: 0 };
      balances.set(userId, b);
    }
    return b;
  };

  for (const settlement of paidSettlements) {
    entry(settlement.fromUserId).sent += settlement.amount;
    entry(settlement.toUserId).received += settlement.amount;
  }

  for (const userId of memberIds) entry(userId);

  for (const expense of expenses) {
    entry(expense.paidBy).paid += expense.baseAmount;

    const shares = splitEvenly(
      expense.baseAmount,
      expense.participantIds,
      expense.id,
    );
    for (const [userId, share] of shares) {
      entry(userId).share += share;
    }
  }

  const result = [...balances.values()].map((b) => ({
    ...b,
    balance: b.paid - b.share + b.sent - b.received,
  }));
  result.sort((a, b) => b.balance - a.balance);

  return result;
}

/**
 * Suggest payments that bring every balance to zero. Repeatedly matches the
 * largest debtor with the largest creditor. Each payment clears at least one
 * person, so at most n−1 payments are needed. Ties are broken by user id so
 * suggestions are deterministic.
 */
export function suggestSettlements(
  balances: { userId: string; balance: number }[],
): TripTransfer[] {
  const total = balances.reduce((sum, b) => sum + b.balance, 0);
  if (total !== 0) {
    throw new Error(`Balances must net to zero (got ${total})`);
  }

  const remaining = balances
    .filter((b) => b.balance !== 0)
    .map((b) => ({ userId: b.userId, balance: b.balance }));

  // sign 1 = largest creditor, sign -1 = largest debtor
  const largest = (sign: 1 | -1) =>
    remaining
      .filter((b) => Math.sign(b.balance) === sign)
      .sort(
        (a, b) =>
          sign * (b.balance - a.balance) || a.userId.localeCompare(b.userId),
      )[0];

  const transfers: TripTransfer[] = [];

  for (;;) {
    const creditor = largest(1);
    const debtor = largest(-1);
    if (!creditor || !debtor) break;

    const amount = Math.min(creditor.balance, -debtor.balance);
    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount,
    });
    creditor.balance -= amount;
    debtor.balance += amount;
  }

  return transfers;
}
