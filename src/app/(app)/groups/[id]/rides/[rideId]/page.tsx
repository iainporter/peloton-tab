import { auth } from "@/lib/auth";
import { db } from "@/db";
import { rides, rideRiders, payments, groupMembers, users, groups } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Card, Button } from "@/components/ui";
import Link from "next/link";
import { DeleteRideButton } from "./components/delete-ride-button";
import { DeletePaymentButton } from "./components/delete-payment-button";
import { EditPaymentButton } from "./components/edit-payment-button";

export default async function RideDetailPage({
  params,
}: {
  params: Promise<{ id: string; rideId: string }>;
}) {
  const { id: groupId, rideId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  // Verify membership
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

  if (!membership) notFound();

  const [ride] = await db
    .select()
    .from(rides)
    .where(and(eq(rides.id, rideId), eq(rides.groupId, groupId)))
    .limit(1);

  if (!ride) notFound();

  const riders = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(rideRiders)
    .innerJoin(users, eq(users.id, rideRiders.userId))
    .where(eq(rideRiders.rideId, rideId));

  const ridePayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      note: payments.note,
      paidBy: payments.paidBy,
      payerName: users.name,
      payerAvatar: users.avatarUrl,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.paidBy))
    .where(eq(payments.rideId, rideId));

  const totalPence = ridePayments.reduce((sum, p) => sum + p.amount, 0);
  const perPerson = riders.length > 0 ? totalPence / riders.length : 0;

  const formatAmount = (pence: number) => `£${(pence / 100).toFixed(2)}`;

  const rideDate = new Date(ride.date + "T00:00:00");
  const dateStr = rideDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">
              {ride.title || dateStr}
            </h1>
            {ride.autoDetected && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                Strava
              </span>
            )}
          </div>
          {ride.title && (
            <p className="text-sm text-gray-500">{dateStr}</p>
          )}
        </div>
      </div>

      {/* Riders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Riders ({riders.length})
          </h2>
          <Link
            href={`/groups/${groupId}/rides/${rideId}/edit`}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Edit
          </Link>
        </div>
        <Card className="p-0">
          <div className="flex flex-wrap gap-3 p-4">
            {riders.map((rider) => (
              <div key={rider.id} className="flex items-center gap-2">
                {rider.avatarUrl ? (
                  <Image
                    src={rider.avatarUrl}
                    alt={rider.name}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-orange-600">
                      {rider.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-sm text-gray-700">{rider.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Payments */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Payments
        </h2>
        {ridePayments.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-2">
              No payments yet
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-gray-100 p-0">
            {ridePayments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 px-4 py-3">
                {payment.payerAvatar ? (
                  <Image
                    src={payment.payerAvatar}
                    alt={payment.payerName}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="text-xs font-medium text-orange-600">
                      {payment.payerName.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {payment.payerName} paid {formatAmount(payment.amount)}
                  </p>
                  {payment.note && (
                    <p className="text-xs text-gray-500 truncate">{payment.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <EditPaymentButton
                    groupId={groupId}
                    rideId={rideId}
                    paymentId={payment.id}
                    currentAmount={(payment.amount / 100).toFixed(2)}
                    currentNote={payment.note || ""}
                  />
                  <DeletePaymentButton
                    groupId={groupId}
                    rideId={rideId}
                    paymentId={payment.id}
                  />
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Summary */}
      {ridePayments.length > 0 && (
        <Card>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold text-gray-900">{formatAmount(totalPence)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">Per person ({riders.length} riders)</span>
            <span className="font-semibold text-orange-600">{formatAmount(perPerson)}</span>
          </div>
        </Card>
      )}

      {/* Actions */}
      <Link href={`/groups/${groupId}/rides/${rideId}/payments/new`}>
        <Button className="w-full">I Paid</Button>
      </Link>

      <DeleteRideButton groupId={groupId} rideId={rideId} />
    </div>
  );
}
