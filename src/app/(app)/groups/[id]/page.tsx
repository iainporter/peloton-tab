import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, groupMembers, users, rides, rideRiders, payments } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Card, Button } from "@/components/ui";
import { LeaveGroupButton } from "./leave-button";
import { CopyInviteCode } from "./copy-invite";
import Link from "next/link";
import { getGroupBalances } from "@/lib/balances";

function formatAmount(pence: number) {
  return `£${(Math.abs(pence) / 100).toFixed(2)}`;
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);

  if (!group) notFound();

  // Verify user is a member
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, id), eq(groupMembers.userId, session.user.id)),
    )
    .limit(1);

  if (!membership) notFound();

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, id));

  const [balances, allRides] = await Promise.all([
    getGroupBalances(id),
    db
      .select({
        id: rides.id,
        date: rides.date,
        title: rides.title,
        autoDetected: rides.autoDetected,
      })
      .from(rides)
      .where(eq(rides.groupId, id))
      .orderBy(desc(rides.date)),
  ]);

  // Build balance map for quick lookup
  const balanceMap = new Map(balances.map((b) => [b.userId, b]));

  // Get rider counts, payment details, and rider names for each ride (activity feed)
  const rideDetails = await Promise.all(
    allRides.map(async (ride) => {
      const [riderRows, paymentRows] = await Promise.all([
        db
          .select({ userId: rideRiders.userId, name: users.name })
          .from(rideRiders)
          .innerJoin(users, eq(users.id, rideRiders.userId))
          .where(eq(rideRiders.rideId, ride.id)),
        db
          .select({
            amount: payments.amount,
            payerName: users.name,
          })
          .from(payments)
          .innerJoin(users, eq(users.id, payments.paidBy))
          .where(eq(payments.rideId, ride.id)),
      ]);

      const totalPence = paymentRows.reduce((s, p) => s + p.amount, 0);

      return {
        ...ride,
        riders: riderRows,
        riderCount: riderRows.length,
        payments: paymentRows,
        totalPence,
        perPerson: riderRows.length > 0 ? totalPence / riderRows.length : 0,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
        <p className="text-sm text-gray-500">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>

      {/* Invite Code */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Invite Code
            </p>
            <p className="mt-1 text-2xl font-mono font-bold tracking-widest text-gray-900">
              {group.inviteCode}
            </p>
          </div>
          <CopyInviteCode code={group.inviteCode} />
        </div>
      </Card>

      {/* Balances */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Balances
        </h2>
        {balances.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-2">
              No payments yet — balances will appear here
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-gray-100 p-0">
            {members.map((member) => {
              const bal = balanceMap.get(member.id);
              const balance = bal?.balance ?? 0;
              return (
                <Link
                  key={member.id}
                  href={`/groups/${id}/members/${member.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  {member.avatarUrl ? (
                    <Image
                      src={member.avatarUrl}
                      alt={member.name}
                      width={36}
                      height={36}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-orange-600">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {member.name}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      balance > 0
                        ? "text-green-600"
                        : balance < 0
                          ? "text-red-600"
                          : "text-gray-400"
                    }`}
                  >
                    {balance === 0
                      ? "even"
                      : balance > 0
                        ? `+${formatAmount(balance)}`
                        : `-${formatAmount(balance)}`}
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      {/* Activity Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Activity
          </h2>
          <Link
            href={`/groups/${id}/rides/new`}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            Log a ride
          </Link>
        </div>
        {rideDetails.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No rides yet — log your first ride!
          </p>
        ) : (
          <div className="space-y-3">
            {rideDetails.map((ride) => {
              const rideDate = new Date(ride.date + "T00:00:00");
              const dateStr = rideDate.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <Link
                  key={ride.id}
                  href={`/groups/${id}/rides/${ride.id}`}
                  className="block"
                >
                  <Card className="hover:border-orange-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900">
                            {ride.title || dateStr}
                          </p>
                          {ride.autoDetected && (
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                              Strava
                            </span>
                          )}
                        </div>
                        {ride.title && (
                          <p className="text-xs text-gray-500">{dateStr}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {ride.riders.map((r) => r.name.split(" ")[0]).join(", ")}
                        </p>
                      </div>
                      {ride.totalPence > 0 && (
                        <div className="text-right ml-3 shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatAmount(ride.totalPence)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatAmount(ride.perPerson)}/ea
                          </p>
                        </div>
                      )}
                    </div>
                    {ride.payments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        {ride.payments.map((p, i) => (
                          <p key={i} className="text-xs text-gray-500">
                            {p.payerName} paid {formatAmount(p.amount)}
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave Group */}
      <LeaveGroupButton groupId={group.id} />
    </div>
  );
}
