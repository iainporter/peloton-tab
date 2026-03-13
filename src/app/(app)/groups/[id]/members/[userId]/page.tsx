import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, groupMembers, users, rides, rideRiders, payments } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui";
import Link from "next/link";
import { getGroupBalances } from "@/lib/balances";

function formatAmount(pence: number) {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`;
}

export default async function MemberHistoryPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  const { id: groupId, userId: memberId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  // Verify current user is a member of this group
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

  // Get the member's info
  const [member] = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, memberId))
    .limit(1);

  if (!member) notFound();

  const [group] = await db
    .select({ name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  // Get balances
  const balances = await getGroupBalances(groupId);
  const memberBalance = balances.find((b) => b.userId === memberId);
  const balance = memberBalance?.balance ?? 0;
  const credit = memberBalance?.credit ?? 0;
  const debit = memberBalance?.debit ?? 0;

  // Get rides this member participated in (within this group)
  const memberRides = await db
    .select({
      rideId: rideRiders.rideId,
      rideDate: rides.date,
      rideTitle: rides.title,
    })
    .from(rideRiders)
    .innerJoin(rides, eq(rides.id, rideRiders.rideId))
    .where(
      and(eq(rideRiders.userId, memberId), eq(rides.groupId, groupId)),
    )
    .orderBy(desc(rides.date));

  // Get payments this member made on rides in this group
  const memberPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      note: payments.note,
      createdAt: payments.createdAt,
      rideId: payments.rideId,
      rideDate: rides.date,
      rideTitle: rides.title,
    })
    .from(payments)
    .innerJoin(rides, eq(rides.id, payments.rideId))
    .where(
      and(eq(payments.paidBy, memberId), eq(rides.groupId, groupId)),
    )
    .orderBy(desc(payments.createdAt));

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
        {member.avatarUrl ? (
          <Image
            src={member.avatarUrl}
            alt={member.name}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
            <span className="text-base font-medium text-orange-600">
              {member.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{member.name}</h1>
          <p className="text-sm text-gray-500">{group?.name}</p>
        </div>
      </div>

      {/* Balance Summary */}
      <Card>
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Net Balance
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${
              balance > 0
                ? "text-green-600"
                : balance < 0
                  ? "text-red-600"
                  : "text-gray-400"
            }`}
          >
            {balance > 0 && "+"}
            {balance === 0 ? "Even" : formatAmount(balance)}
            {balance < 0 && " owed"}
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Total Paid</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatAmount(credit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Share Owed</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatAmount(debit)}
            </p>
          </div>
        </div>
      </Card>

      {/* Payments Made */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Payments Made ({memberPayments.length})
        </h2>
        {memberPayments.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-2">
              No payments yet
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-gray-100 p-0">
            {memberPayments.map((payment) => {
              const rideDate = new Date(payment.rideDate + "T00:00:00");
              const dateStr = rideDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });
              return (
                <Link
                  key={payment.id}
                  href={`/groups/${groupId}/rides/${payment.rideId}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {payment.rideTitle || dateStr}
                    </p>
                    {payment.rideTitle && (
                      <p className="text-xs text-gray-500">{dateStr}</p>
                    )}
                    {payment.note && (
                      <p className="text-xs text-gray-400">{payment.note}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-green-600">
                    +{formatAmount(payment.amount)}
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      {/* Rides Participated */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Rides ({memberRides.length})
        </h2>
        {memberRides.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-2">
              No rides yet
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-gray-100 p-0">
            {memberRides.map((ride) => {
              const rideDate = new Date(ride.rideDate + "T00:00:00");
              const dateStr = rideDate.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <Link
                  key={ride.rideId}
                  href={`/groups/${groupId}/rides/${ride.rideId}`}
                  className="flex items-center px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ride.rideTitle || dateStr}
                    </p>
                    {ride.rideTitle && (
                      <p className="text-xs text-gray-500">{dateStr}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
