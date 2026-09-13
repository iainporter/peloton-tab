import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar, Button, Card } from "@/components/ui";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { getTripForGroupMember, getTripLedger } from "@/lib/trip-data";
import { formatBalance, formatMoney } from "@/lib/money";
import { formatTripDates } from "@/lib/trips";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string; tripId: string }>;
}) {
  const { id: groupId, tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const trip = await getTripForGroupMember(groupId, tripId, userId);
  if (!trip) notFound();

  const { members, expenses, balances, settlements, totalMinor } =
    await getTripLedger(tripId);
  const outstandingCount = settlements.filter((s) => s.status === "suggested").length;

  const currency = trip.baseCurrency;
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const isTripMember = memberMap.has(userId);
  const canEdit = isTripMember && trip.status === "open";
  const myBalance = balances.find((b) => b.userId === userId)?.balance ?? 0;
  const dates = formatTripDates(trip.startDate, trip.endDate);

  // Expenses arrive newest first — group them by date
  const expensesByDate = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    const list = expensesByDate.get(expense.date) ?? [];
    list.push(expense);
    expensesByDate.set(expense.date, list);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{trip.name}</h1>
            <TripStatusBadge status={trip.status} />
          </div>
          <p className="text-sm text-gray-500">
            {dates ? `${dates} · ${currency}` : currency}
          </p>
        </div>
        {isTripMember && (
          <Link
            href={`/groups/${groupId}/trips/${tripId}/settings`}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Settings
          </Link>
        )}
      </div>

      {/* Settlement status */}
      {trip.status === "settling" && (
        <Link
          href={`/groups/${groupId}/trips/${tripId}/settle`}
          className="block rounded-xl border border-amber-200 bg-amber-50 p-4 hover:border-amber-300"
        >
          <p className="text-sm font-medium text-amber-800">
            Settling up — {outstandingCount}{" "}
            {outstandingCount === 1 ? "payment" : "payments"} still to make
          </p>
          <p className="text-xs text-amber-700">
            Expenses are locked until everyone has paid or the trip is reopened
          </p>
        </Link>
      )}
      {trip.status === "settled" && (
        <Link
          href={`/groups/${groupId}/trips/${tripId}/settle`}
          className="block rounded-xl border border-green-200 bg-green-50 p-4 hover:border-green-300"
        >
          <p className="text-sm font-medium text-green-800">
            This trip is settled
          </p>
          <p className="text-xs text-green-700">View settlement payments</p>
        </Link>
      )}

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Trip Total</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatMoney(totalMinor, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Your Balance</p>
            {isTripMember ? (
              <p
                className={`text-lg font-semibold ${
                  myBalance > 0
                    ? "text-green-600"
                    : myBalance < 0
                      ? "text-red-600"
                      : "text-gray-400"
                }`}
              >
                {formatBalance(myBalance, currency)}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Not on this trip</p>
            )}
          </div>
        </div>
      </Card>

      {/* Balances */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Balances
        </h2>
        <Card className="divide-y divide-gray-100 p-0">
          {balances.map((b) => {
            const member = memberMap.get(b.userId);
            if (!member) return null;
            return (
              <div key={b.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={member.name} src={member.avatarUrl} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">
                    Paid {formatMoney(b.paid, currency)} · Share{" "}
                    {formatMoney(b.share, currency)}
                    {(b.sent > 0 || b.received > 0) &&
                      ` · Settled ${formatBalance(b.sent - b.received, currency)}`}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    b.balance > 0
                      ? "text-green-600"
                      : b.balance < 0
                        ? "text-red-600"
                        : "text-gray-400"
                  }`}
                >
                  {formatBalance(b.balance, currency)}
                </span>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Expenses */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Expenses ({expenses.length})
        </h2>
        {expenses.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-2">
              No expenses yet — add the first one
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...expensesByDate].map(([date, dayExpenses]) => (
              <div key={date}>
                <p className="mb-1.5 text-xs font-medium text-gray-500">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <Card className="divide-y divide-gray-100 p-0">
                  {dayExpenses.map((expense) => {
                    const everyone =
                      expense.participantIds.length === members.length;
                    const content = (
                      <div className="flex items-start justify-between px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {expense.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {expense.payerName} paid
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {everyone
                              ? "Split between everyone"
                              : `Split between ${expense.participantIds
                                  .map((id) => memberMap.get(id)?.name.split(" ")[0])
                                  .filter(Boolean)
                                  .join(", ")}`}
                          </p>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatMoney(expense.baseAmount, currency)}
                          </p>
                          {expense.currency !== currency && (
                            <p className="text-xs text-gray-500">
                              {formatMoney(expense.amount, expense.currency)}
                            </p>
                          )}
                          {expense.participantIds.length > 1 && (
                            <p className="text-xs text-gray-500">
                              {formatMoney(
                                Math.round(
                                  expense.baseAmount / expense.participantIds.length,
                                ),
                                currency,
                              )}
                              /ea
                            </p>
                          )}
                        </div>
                      </div>
                    );

                    return canEdit ? (
                      <Link
                        key={expense.id}
                        href={`/groups/${groupId}/trips/${tripId}/expenses/${expense.id}/edit`}
                        className="block hover:bg-gray-50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={expense.id}>{content}</div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="space-y-3">
          <Link
            href={`/groups/${groupId}/trips/${tripId}/expenses/new`}
            className="block"
          >
            <Button className="w-full">Add Expense</Button>
          </Link>
          {expenses.length > 0 && (
            <Link
              href={`/groups/${groupId}/trips/${tripId}/settle`}
              className="block"
            >
              <Button variant="secondary" className="w-full">
                Settle Up
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
