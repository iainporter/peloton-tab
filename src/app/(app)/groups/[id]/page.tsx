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

  const recentRides = await db
    .select({
      id: rides.id,
      date: rides.date,
      title: rides.title,
    })
    .from(rides)
    .where(eq(rides.groupId, id))
    .orderBy(desc(rides.date))
    .limit(5);

  // Get rider counts and payment totals for each ride
  const rideDetails = await Promise.all(
    recentRides.map(async (ride) => {
      const riderCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(rideRiders)
        .where(eq(rideRiders.rideId, ride.id));

      const totalPayments = await db
        .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(eq(payments.rideId, ride.id));

      return {
        ...ride,
        riderCount: Number(riderCount[0].count),
        totalPence: Number(totalPayments[0].total),
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

      {/* Members */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Members
        </h2>
        <Card className="divide-y divide-gray-100 p-0">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3"
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
                  {member.id === group.createdBy && (
                    <span className="ml-2 text-xs text-gray-400">Creator</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent Rides */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Recent Rides
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
          <Card className="divide-y divide-gray-100 p-0">
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
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {ride.title || dateStr}
                    </p>
                    {ride.title && (
                      <p className="text-xs text-gray-500">{dateStr}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {ride.riderCount} {ride.riderCount === 1 ? "rider" : "riders"}
                    </p>
                  </div>
                  {ride.totalPence > 0 && (
                    <span className="text-sm font-semibold text-gray-900">
                      £{(ride.totalPence / 100).toFixed(2)}
                    </span>
                  )}
                </Link>
              );
            })}
          </Card>
        )}
      </div>

      {/* Leave Group */}
      <LeaveGroupButton groupId={group.id} />
    </div>
  );
}
