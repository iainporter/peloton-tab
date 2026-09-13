import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar, Card } from "@/components/ui";
import { TripStatusBadge } from "@/components/trip-status-badge";
import { getTripForGroupMember, getTripLedger } from "@/lib/trip-data";
import { formatMoney } from "@/lib/money";
import { suggestSettlements } from "@/lib/trips";
import { markSettlementPaid, undoSettlementPayment } from "../../actions";
import { SettleTripButton } from "../components/settle-trip-button";
import { ReopenTripButton } from "../components/reopen-trip-button";

type Person = { id: string; name: string; avatarUrl: string | null };

function PaymentRow({
  from,
  to,
  amount,
  currency,
  userId,
  detail,
  action,
}: {
  from: Person;
  to: Person;
  amount: number;
  currency: string;
  userId: string;
  detail?: string;
  action?: ReactNode;
}) {
  const fromYou = from.id === userId;
  const toYou = to.id === userId;
  const label = `${fromYou ? "You pay" : `${from.name.split(" ")[0]} pays`} ${
    toYou ? "you" : to.name.split(" ")[0]
  }`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        fromYou || toYou ? "bg-orange-50/50" : ""
      }`}
    >
      <Avatar name={from.name} src={from.avatarUrl} />
      <svg className="h-4 w-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
      <Avatar name={to.name} src={to.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
      </div>
      <span className="text-sm font-semibold text-gray-900">
        {formatMoney(amount, currency)}
      </span>
      {action}
    </div>
  );
}

export default async function SettleTripPage({
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

  const { members, balances, settlements } = await getTripLedger(tripId);

  const currency = trip.baseCurrency;
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const isTripMember = memberMap.has(userId);
  const person = (id: string): Person =>
    memberMap.get(id) ?? { id, name: "Former member", avatarUrl: null };

  const outstanding = settlements.filter((s) => s.status === "suggested");
  const paid = settlements.filter((s) => s.status === "paid");
  const preview = trip.status === "open" ? suggestSettlements(balances) : [];

  const paidDetail = (paidAt: Date | null) =>
    paidAt
      ? `Paid ${paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : "Paid";

  const undoButton = (settlementId: string, fromUserId: string, toUserId: string) =>
    trip.status !== "settled" &&
    (fromUserId === userId || toUserId === userId) && (
      <form action={undoSettlementPayment.bind(null, groupId, tripId, settlementId)}>
        <button
          type="submit"
          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Undo
        </button>
      </form>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/groups/${groupId}/trips/${tripId}`}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Settle Up</h1>
            <TripStatusBadge status={trip.status} />
          </div>
          <p className="text-sm text-gray-500">{trip.name}</p>
        </div>
      </div>

      {/* Open: preview the payments settling would create */}
      {trip.status === "open" && (
        <>
          <Card>
            <p className="text-sm text-gray-700">
              {preview.length === 0
                ? "Everyone is even. Settling marks the trip as settled."
                : `${preview.length} ${
                    preview.length === 1 ? "payment" : "payments"
                  } will settle this trip. Expenses are locked while everyone pays.`}
            </p>
          </Card>

          {preview.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Suggested Payments
              </h2>
              <Card className="divide-y divide-gray-100 p-0">
                {preview.map((t) => (
                  <PaymentRow
                    key={`${t.fromUserId}-${t.toUserId}`}
                    from={person(t.fromUserId)}
                    to={person(t.toUserId)}
                    amount={t.amount}
                    currency={currency}
                    userId={userId}
                  />
                ))}
              </Card>
            </div>
          )}

          {isTripMember && (
            <SettleTripButton
              groupId={groupId}
              tripId={tripId}
              paymentCount={preview.length}
            />
          )}
        </>
      )}

      {/* Settling: payments still to make */}
      {trip.status === "settling" && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            To Pay ({outstanding.length})
          </h2>
          <Card className="divide-y divide-gray-100 p-0">
            {outstanding.map((s) => (
              <PaymentRow
                key={s.id}
                from={person(s.fromUserId)}
                to={person(s.toUserId)}
                amount={s.amount}
                currency={currency}
                userId={userId}
                action={
                  (s.fromUserId === userId || s.toUserId === userId) && (
                    <form action={markSettlementPaid.bind(null, groupId, tripId, s.id)}>
                      <button
                        type="submit"
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                      >
                        Mark paid
                      </button>
                    </form>
                  )
                }
              />
            ))}
          </Card>
          <p className="mt-1 text-xs text-gray-500">
            PelotonTab doesn&apos;t move money — pay each other as usual, then
            either person marks the payment as paid.
          </p>
        </div>
      )}

      {trip.status === "settled" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            This trip is settled
          </p>
          <p className="text-xs text-green-700">
            Everyone is even, and members can leave the group.
          </p>
        </div>
      )}

      {/* Payments made */}
      {paid.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {trip.status === "open" ? "Earlier Payments" : "Paid"} ({paid.length})
          </h2>
          <Card className="divide-y divide-gray-100 p-0">
            {paid.map((s) => (
              <PaymentRow
                key={s.id}
                from={person(s.fromUserId)}
                to={person(s.toUserId)}
                amount={s.amount}
                currency={currency}
                userId={userId}
                detail={paidDetail(s.paidAt)}
                action={undoButton(s.id, s.fromUserId, s.toUserId)}
              />
            ))}
          </Card>
          {trip.status === "open" && (
            <p className="mt-1 text-xs text-gray-500">
              Payments made before the trip was reopened still count towards
              balances.
            </p>
          )}
        </div>
      )}

      {isTripMember && trip.status !== "open" && (
        <ReopenTripButton groupId={groupId} tripId={tripId} />
      )}
    </div>
  );
}
